import crypto from "crypto"
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
}

export const OTP_EVENT = "phone-auth.otp.generated"

/**
 * تسجيل الدخول برمز واتساب بلا كلمة مرور.
 *   POST /auth/customer/phone-auth           { phone }       → يرسل رمزاً (ويُنشئ الهوية أول مرة)
 *   POST /auth/customer/phone-auth/callback  ?phone&otp      → يتحقق ويعيد JWT
 * الرمز: 6 أرقام من crypto.randomInt، يُخزَّن كـ HMAC، صالح 5 دقائق، 5 محاولات، إعادة إرسال كل 60 ثانية.
 */
class PhoneAuthService extends AbstractAuthModuleProvider {
  static identifier = "phone-auth"
  static DISPLAY_NAME = "رمز واتساب"

  protected options_: Required<Options>
  protected logger_: Logger
  protected eventBus_: Deps["event_bus"]

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
      ...options,
    }
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

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
    await svc.update(phone, {
      provider_metadata: {
        otp_hash: this.hash(phone, otp),
        otp_expires_at: now + this.options_.ttlSeconds * 1000,
        otp_sent_at: now,
        otp_attempts: 0,
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
      provider_metadata: { otp_hash: null, otp_expires_at: null, otp_sent_at: state.otp_sent_at ?? null, otp_attempts: 0 },
    })
    return { success: true, authIdentity: updated }
  }
}

export default PhoneAuthService
