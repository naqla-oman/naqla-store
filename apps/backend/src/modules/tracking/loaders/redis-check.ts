import type { LoaderOptions } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Redis from "ioredis"

/**
 * H7 (ملاحظة التحقق المستقل): إن أقلع الخادم وRedis غير متاح يموت عامل event-bus-redis بصمت
 * فتتراكم الأحداث (لا رموز دخول ولا إشعارات). هنا: عند ضبط REDIS_URL نتحقق قبل الجاهزية،
 * ونُنهي العملية بخطأ واضح بعد محاولات قصيرة — ليعيد Docker تشغيلها حين يصبح Redis جاهزاً.
 */
export default async function redisCheck({ container }: LoaderOptions) {
  const url = process.env.REDIS_URL
  if (!url) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { info: (m: string) => void; error: (m: string) => void }
  for (let attempt = 1; attempt <= 5; attempt++) {
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
  logger.error(`[naqla] Redis غير متاح على ${new URL(url).host} بعد 5 محاولات — الإيقاف (الأحداث ورموز الدخول تعتمد عليه)`)
  process.exit(1)
}
