import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * H1: تعديل المنتج أو السعر أو المخزون أو القسم أو المجموعة من اللوحة ← إبطال ذاكرة الواجهة.
 * الأحداث المتلاحقة (طلب يحجز عدة متغيّرات) تُجمع في نداء واحد كل ثانيتين.
 */
const TAGS: Record<string, string[]> = {
  product: ["products"],
  "product-variant": ["products"],
  "product-option": ["products"],
  // M19: أسعار خيارات التوصيل (ومنها قاعدة المجاني) أسعار في وحدة التسعير
  price: ["products", "shipping-threshold"],
  "price-set": ["products", "shipping-threshold"],
  "price-rule": ["shipping-threshold"],
  "shipping-option": ["shipping-threshold"],
  "inventory-level": ["products"],
  "inventory-item": ["products"],
  "reservation-item": ["products"],
  "product-category": ["categories", "products"],
  "product-collection": ["collections", "products"],
  region: ["regions", "products"],
}

let pending = new Set<string>()
let timer: NodeJS.Timeout | null = null

export default async function revalidateStorefront({ event, container }: SubscriberArgs<{ id?: string }>) {
  const model = event.name.split(".")[0]
  for (const t of TAGS[model] ?? []) pending.add(t)
  if (timer || !pending.size) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  timer = setTimeout(async () => {
    const tags = [...pending]
    pending = new Set()
    timer = null
    const url = process.env.STOREFRONT_URL
    const secret = process.env.REVALIDATE_SECRET
    if (!url || !secret) return
    try {
      const res = await fetch(`${url}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) logger.warn(`[revalidate] ${res.status} للوسوم ${tags.join(",")}`)
    } catch (e) {
      logger.warn(`[revalidate] تعذّر الوصول للواجهة: ${(e as Error).message}`)
    }
  }, 2000)
}

export const config: SubscriberConfig = {
  event: Object.keys(TAGS).flatMap((m) => [`${m}.created`, `${m}.updated`, `${m}.deleted`]),
}
