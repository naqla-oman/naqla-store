import type { LoaderOptions } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Redis from "ioredis"

/**
 * H7 (ملاحظة التحقق المستقل): إن أقلع الخادم وRedis غير متاح يموت عامل event-bus-redis بصمت
 * فتتراكم الأحداث (لا رموز دخول ولا إشعارات). هنا: عند ضبط REDIS_URL نتحقق قبل الجاهزية،
 * في الإنتاج ننهي العملية بخطأ واضح بعد محاولات قصيرة (ليعيد Docker تشغيلها حين يصبح Redis جاهزاً)؛
 * في التطوير تحذير واضح والاستمرار، حتى لا يموت medusa develop عند إعادة التشغيل التلقائي.
 */
export default async function redisCheck({ container }: LoaderOptions) {
  const url = process.env.REDIS_URL
  if (!url) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void }
  const attempts = process.env.NODE_ENV === "production" ? 5 : 2
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 3000, retryStrategy: () => null })
    try {
      await r.connect()
      if ((await r.ping()) === "PONG") {
        logger.info(`[naqla] Redis متاح (${new URL(url).host})`)
        r.disconnect()
        return
      }
    } catch {
      /* محاولة أخرى */
    } finally {
      r.disconnect()
    }
    await new Promise((ok) => setTimeout(ok, 2000))
  }
  const where = new URL(url).host
  if (process.env.NODE_ENV === "production") {
    logger.error(`[naqla] Redis غير متاح على ${where} بعد 5 محاولات — الإيقاف (الأحداث ورموز الدخول تعتمد عليه)`)
    process.exit(1)
  }
  logger.warn(`[naqla] تحذير: Redis غير متاح على ${where} — وحدات Medusa (الأحداث والأقفال) ستنتظره ولن يكتمل الإقلاع. للتطوير بلا Redis احذف REDIS_URL (تعمل الوحدات في الذاكرة). في الإنتاج يتوقف الخادم هنا.`)
}
