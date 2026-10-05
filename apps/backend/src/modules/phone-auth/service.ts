import crypto from "crypto"
import Redis from "ioredis"
import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types"

type Options = {
  /** سر توقيع الرموز (HMAC) — يُضبط من PHONE_AUTH_SECRET */
  secret: string
  /** نمط الرقم المقبول بعد التطبيع، افتراضياً عُماني */
  phonePattern?: string
  ttlSeconds?: number
  resendSeconds?: number
  maxAttempts?: number
  /** رموز لكل رقم في اليوم */
  maxSendsPerDay?: number
  /** طلبات رمز لكل IP في الساعة */
  ipSendsPerHour?: number
  /** محاولات تحقق لكل IP في الساعة */
  ipVerifiesPerHour?: number
  /** H6: عند ضبطه تنتقل الأقفال والحدود إلى Redis (مشتركة بين كل عمليات المتجر) */
  redisUrl?: string
  redisPrefix?: string
}

type Deps = {
  logger: Logger
  event_bus: { emit: (msg: { name: string; data: unknown }, opts?: unknown) => Promise<void> }
}

type OtpState = {
  otp_hash?: string | null
  otp_expires_at?: number | null
  otp_sent_at?: number | null
  otp_attempts?: number
  /** سقف يومي للإرسال لكل رقم (يبقى بعد إعادة التشغيل) */
  otp_day?: string
  otp_day_count?: number
}

export const OTP_EVENT = "phone-auth.otp.generated"

/**
 * تسجيل الدخول برمز واتساب بلا كلمة مرور.
 *   POST /auth/customer/phone-auth           { phone }       → يرسل رمزاً (ويُنشئ الهوية أول مرة)
 *   POST /auth/customer/phone-auth/callback  ?phone&otp      → يتحقق ويعيد JWT
 * الرمز: 6 أرقام من crypto.randomInt، يُخزَّن كـ HMAC، صالح 5 دقائق، 5 محاولات، إعادة إرسال كل 60 ثانية.
 */
/* ===== C2: أقفال وحدود (ذاكرة العملية، أو Redis عند توفره — H6) ===== */

type Guard = {
  lock<T>(key: string, fn: () => Promise<T>): Promise<T>
  overLimit(key: string, max: number, windowMs: number): Promise<boolean>
}

/** Redis: قفل SET NX PX مع انتظار قصير، وعدّاد INCR بنافذة ثابتة */
function redisGuard(url: string, prefix: string): Guard {
  const r = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false })
  const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
  return {
    async lock(key, fn) {
      const k = `${prefix}lock:${key}`
      const token = crypto.randomBytes(12).toString("hex")
      for (let i = 0; i < 200; i++) {
        if ((await r.set(k, token, "PX", 15_000, "NX")) === "OK") {
          try {
            return await fn()
          } finally {
            // تحرير القفل فقط إن كان ما زال لنا
            await r.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end', 1, k, token)
          }
        }
        await sleep(25 + Math.random() * 25)
      }
      throw new MedusaError(MedusaError.Types.CONFLICT, "الخادم مشغول — حاول بعد لحظات")
    },
    async overLimit(key, max, windowMs) {
      const k = `${prefix}rl:${key}:${Math.floor(Date.now() / windowMs)}`
      const n = await r.incr(k)
      if (n === 1) await r.pexpire(k, windowMs)
      return n > max
    },
  }
}

/** الذاكرة (تطوير بلا Redis): نفس الواجهة */
function memoryGuard(): Guard {
  return {
    lock: (key, fn) => withLock(key, fn),
    overLimit: async (key, max, windowMs) => overLimit(key, max, windowMs),
  }
}

/** قفل لكل مفتاح (رقم): العمليات على الرقم نفسه تُنفَّذ بالتتابع، فلا تُقرأ المحاولات قديمة */
const locks = new Map<string, Promise<unknown>>()
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve()
  const run = prev.catch(() => undefined).then(fn)
  const tail = run.catch(() => undefined)
  locks.set(key, tail)
  try {
    return await run
  } finally {
    if (locks.get(key) === tail) locks.delete(key)
  }
}

/** نافذة منزلقة لكل IP (في الذاكرة؛ تنتقل إلى Redis مع ربطه — H6) */
const hits = new Map<string, number[]>()
function overLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) {
    hits.set(key, list)
    return true
  }
  list.push(now)
  hits.set(key, list)
  if (hits.size > 50_000) hits.clear() // حماية الذاكرة من مفاتيح عشوائية
  return false
}
const ipOf = (data: AuthenticationInput) => {
  const h = (data.headers ?? {}) as Record<string, string | string[] | undefined>
  const fwd = h["x-forwarded-for"]
  // أقرب عنوان وضعه الوكيل الموثوق (Caddy) هو الأخير في السلسلة
  const chain = String(Array.isArray(fwd) ? fwd.join(",") : fwd ?? "").split(",").map((x) => x.trim()).filter(Boolean)
  return chain[chain.length - 1] || String(h["x-real-ip"] ?? "unknown")
}
const today = () => new Date().toISOString().slice(0, 10)

class PhoneAuthService extends AbstractAuthModuleProvider {
  static identifier = "phone-auth"
  static DISPLAY_NAME = "رمز واتساب"

  protected options_: Required<Options>
  protected logger_: Logger
  protected eventBus_: Deps["event_bus"]
  protected guard_: Guard

  static validateOptions(options: Record<string, unknown>) {
    if (!options.secret || String(options.secret).length < 16) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "phone-auth: PHONE_AUTH_SECRET مطلوب (16 حرفاً على الأقل)")
    }
  }

  constructor(container: Deps, options: Options) {
    // @ts-ignore — توقيع المُنشئ في الفئة الأساسية
    super(...arguments)
    this.logger_ = container.logger
    this.eventBus_ = container.event_bus
    this.options_ = {
      phonePattern: "^\\+968[79][0-9]{7}$",
      ttlSeconds: 300,
      resendSeconds: 60,
      maxAttempts: 5,
      maxSendsPerDay: 8,
      ipSendsPerHour: 20,
      ipVerifiesPerHour: 60,
      redisUrl: "",
      redisPrefix: "otp:",
      ...options,
    } as Required<Options>
    this.guard_ = this.options_.redisUrl ? redisGuard(this.options_.redisUrl, this.options_.redisPrefix) : memoryGuard()
  }

  /** يقبل 9XXXXXXX أو 968XXXXXXXX أو +968XXXXXXXX ويعيد +968XXXXXXXX */
  protected normalize(raw: unknown): string | null {
    const digits = String(raw ?? "").replace(/\D/g, "")
    const phone = digits.length === 8 ? `+968${digits}` : digits.startsWith("968") ? `+${digits}` : `+${digits}`
    return new RegExp(this.options_.phonePattern).test(phone) ? phone : null
  }

  protected hash(phone: string, otp: string) {
    return crypto.createHmac("sha256", this.options_.secret).update(`${phone}:${otp}`).digest("hex")
  }

  protected stateOf(identity: any): OtpState {
    const p = identity?.provider_identities?.find((x: any) => x.provider === PhoneAuthService.identifier)
    return (p?.provider_metadata ?? {}) as OtpState
  }

  async register(data: AuthenticationInput, svc: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    // التسجيل يتم ضمن authenticate (أول رمز يُنشئ الهوية) — هذا المسار يحيل إليه
    return this.authenticate(data, svc)
  }

  async authenticate(data: AuthenticationInput, svc: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    const phone = this.normalize((data.body as any)?.phone)
    if (!phone) return { success: false, error: "رقم الهاتف غير صحيح" }
    if (await this.guard_.overLimit(`send:${ipOf(data)}`, this.options_.ipSendsPerHour, 3600_000)) {
      return { success: false, error: "طلبات كثيرة من هذا الجهاز — حاول بعد ساعة" }
    }
    return this.guard_.lock(`otp:${phone}`, () => this.sendCode(phone, svc))
  }

  protected async sendCode(phone: string, svc: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    let identity: any
    try {
      identity = await svc.retrieve({ entity_id: phone })
    } catch {
      identity = await svc.create({ entity_id: phone })
    }

    const now = Date.now()
    const state = this.stateOf(identity)
    if (state.otp_sent_at && now - state.otp_sent_at < this.options_.resendSeconds * 1000) {
      const wait = Math.ceil((this.options_.resendSeconds * 1000 - (now - state.otp_sent_at)) / 1000)
      return { success: false, error: `انتظري ${wait} ثانية قبل طلب رمز جديد` }
    }

    // سقف يومي لكل رقم (يحمي من استنزاف رسائل واتساب المدفوعة على رقم واحد)
    const day = today()
    const sentToday = state.otp_day === day ? state.otp_day_count ?? 0 : 0
    if (sentToday >= this.options_.maxSendsPerDay) {
      return { success: false, error: "تجاوزت عدد الرموز المسموح اليوم لهذا الرقم — حاول غداً أو تواصل معنا" }
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
    await svc.update(phone, {
      provider_metadata: {
        otp_hash: this.hash(phone, otp),
        otp_expires_at: now + this.options_.ttlSeconds * 1000,
        otp_sent_at: now,
        otp_attempts: 0,
        otp_day: day,
        otp_day_count: sentToday + 1,
      } satisfies OtpState,
    })

    await this.eventBus_.emit({ name: OTP_EVENT, data: { phone, otp } })
    return { success: true, location: "otp" }
  }

  async validateCallback(data: AuthenticationInput, svc: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    const src = { ...(data.query ?? {}), ...((data.body as any) ?? {}) } as Record<string, unknown>
    const phone = this.normalize(src.phone)
    const otp = String(src.otp ?? "").replace(/\D/g, "")
    if (!phone || otp.length !== 6) return { success: false, error: "أدخلي الرمز المكوّن من 6 أرقام" }
    if (await this.guard_.overLimit(`verify:${ipOf(data)}`, this.options_.ipVerifiesPerHour, 3600_000)) {
      return { success: false, error: "محاولات كثيرة من هذا الجهاز — حاول بعد ساعة" }
    }
    // C2: القراءة والعدّ والكتابة داخل قفل الرقم — الطلبات المتوازية تُعدّ واحدة واحدة
    return this.guard_.lock(`otp:${phone}`, () => this.checkCode(phone, otp, svc))
  }

  protected async checkCode(phone: string, otp: string, svc: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    let identity: any
    try {
      identity = await svc.retrieve({ entity_id: phone })
    } catch {
      return { success: false, error: "اطلبي رمزاً أولاً" }
    }

    const state = this.stateOf(identity)
    if (!state.otp_hash || !state.otp_expires_at) return { success: false, error: "اطلبي رمزاً جديداً" }
    if (Date.now() > state.otp_expires_at) {
      await svc.update(phone, { provider_metadata: { ...state, otp_hash: null } })
      return { success: false, error: "انتهت صلاحية الرمز — اطلبي رمزاً جديداً" }
    }

    const attempts = (state.otp_attempts ?? 0) + 1
    const ok =
      crypto.timingSafeEqual(Buffer.from(this.hash(phone, otp)), Buffer.from(state.otp_hash))
    if (!ok) {
      const exhausted = attempts >= this.options_.maxAttempts
      await svc.update(phone, {
        provider_metadata: { ...state, otp_attempts: attempts, otp_hash: exhausted ? null : state.otp_hash },
      })
      return {
        success: false,
        error: exhausted ? "تجاوزتِ عدد المحاولات — اطلبي رمزاً جديداً" : `الرمز غير صحيح (تبقّى ${this.options_.maxAttempts - attempts})`,
      }
    }

    // رمز صحيح: يُستهلك مرة واحدة
    const updated = await svc.update(phone, {
      provider_metadata: { ...state, otp_hash: null, otp_expires_at: null, otp_attempts: 0 },
    })
    return { success: true, authIdentity: updated }
  }
}

export default PhoneAuthService
