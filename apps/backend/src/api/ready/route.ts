import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Redis from "ioredis"

/**
 * GET /ready — جاهزية حقيقية: قاعدة البيانات + Redis (عند ضبطه).
 * /health المدمج في Medusa معرَّف قبل المسارات ولا يمكن تعديله، فالـ healthcheck في compose يستخدم /ready.
 */
let redis: Redis | null = null

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const checks: Record<string, boolean> = {}
  try {
    await req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION).raw("select 1")
    checks.database = true
  } catch {
    checks.database = false
  }
  if (process.env.REDIS_URL) {
    try {
      redis ??= new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000, enableOfflineQueue: false })
      checks.redis = (await Promise.race([redis.ping(), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 2000))])) === "PONG"
    } catch {
      checks.redis = false
    }
  }
  const ok = Object.values(checks).every(Boolean)
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unavailable", checks })
}
