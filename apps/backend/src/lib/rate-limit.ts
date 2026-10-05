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

type Rule = { name: string; max: number; windowMs: number; key?: (req: MedusaRequest) => string | null; message?: string }

export function rateLimit(rules: Rule[]) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      for (const rule of rules) {
        const k = rule.key ? rule.key(req) : clientIp(req)
        if (!k) continue
        const { over, retryAfter } = await hit(`${rule.name}:${k}`, rule.max, rule.windowMs)
        if (over) {
          res.setHeader("Retry-After", String(retryAfter))
          return res.status(429).json({ type: "too_many_requests", message: rule.message ?? "طلبات كثيرة — حاول بعد قليل" })
        }
      }
    } catch {
      // تعطّل Redis لا يمنع الخدمة (H7 يتكفل بفحص Redis عند الإقلاع)
    }
    next()
  }
}
