import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Redis from "ioredis"

/**
 * H5: حد معدل الطلبات — Redis عند توفر REDIS_URL (مشترك بين العمليات)، وإلا ذاكرة العملية (تطوير).
 * نافذة ثابتة: INCR + PEXPIRE. يُرجع 429 مع Retry-After.
 */
let redis: Redis | null | undefined
const client = () => {
  if (redis === undefined) redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2 }) : null
  return redis
}
const PREFIX = `naqla:${process.env.STORE ?? "store"}:rl:`
const mem = new Map<string, { n: number; until: number }>()

export async function hit(key: string, max: number, windowMs: number): Promise<{ over: boolean; retryAfter: number }> {
  const bucket = Math.floor(Date.now() / windowMs)
  const retryAfter = Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)
  const r = client()
  if (r) {
    const k = `${PREFIX}${key}:${bucket}`
    const n = await r.incr(k)
    if (n === 1) await r.pexpire(k, windowMs)
    return { over: n > max, retryAfter }
  }
  const now = Date.now()
  const e = mem.get(key)
  if (!e || e.until <= now) {
    mem.set(key, { n: 1, until: now + windowMs })
    if (mem.size > 50_000) mem.clear()
    return { over: 1 > max, retryAfter }
  }
  e.n++
  return { over: e.n > max, retryAfter: Math.ceil((e.until - now) / 1000) }
}

/** عنوان العميل: آخر قيمة في X-Forwarded-For (يضيفها Caddy الموثوق)، وإلا عنوان الاتصال */
export const clientIp = (req: MedusaRequest) => {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return fwd[fwd.length - 1] || req.socket?.remoteAddress || "unknown"
}

type Rule = {
  name: string
  max: number
  windowMs: number
  key?: (req: MedusaRequest) => string | null
  message?: string
  /** يُعدّ فقط إن كانت الاستجابة فشلاً (مثل 401 في الدخول) — النجاح لا يقترب من القفل */
  failuresOnly?: boolean
}

/** قراءة العدّاد دون زيادته */
async function peek(key: string, windowMs: number): Promise<{ n: number; retryAfter: number }> {
  const bucket = Math.floor(Date.now() / windowMs)
  const retryAfter = Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)
  const r = client()
  if (r) return { n: Number((await r.get(`${PREFIX}${key}:${bucket}`)) ?? 0), retryAfter }
  const e = mem.get(key)
  return e && e.until > Date.now() ? { n: e.n, retryAfter: Math.ceil((e.until - Date.now()) / 1000) } : { n: 0, retryAfter }
}

export function rateLimit(rules: Rule[]) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const failures: { key: string; windowMs: number; max: number }[] = []
      for (const rule of rules) {
        const k = rule.key ? rule.key(req) : clientIp(req)
        if (!k) continue
        const key = `${rule.name}:${k}`
        let over = false
        let retryAfter = 0
        if (rule.failuresOnly) {
          const p = await peek(key, rule.windowMs)
          over = p.n >= rule.max
          retryAfter = p.retryAfter
          failures.push({ key, windowMs: rule.windowMs, max: rule.max })
        } else {
          ;({ over, retryAfter } = await hit(key, rule.max, rule.windowMs))
        }
        if (over) {
          res.setHeader("Retry-After", String(retryAfter))
          return res.status(429).json({ type: "too_many_requests", message: rule.message ?? "طلبات كثيرة — حاول بعد قليل" })
        }
      }
      // الإخفاقات تُعدّ بعد معرفة نتيجة الطلب
      if (failures.length) {
        res.on("finish", () => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            for (const f of failures) hit(f.key, f.max, f.windowMs).catch(() => undefined)
          }
        })
      }
    } catch {
      // تعطّل Redis لا يمنع الخدمة (H7 يتكفل بفحص Redis عند الإقلاع)
    }
    next()
  }
}
