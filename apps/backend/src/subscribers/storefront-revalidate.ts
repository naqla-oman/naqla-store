import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { queueRevalidate } from "../lib/revalidate"

/**
 * H1: تعديل المنتج أو السعر أو المخزون أو القسم أو المجموعة من اللوحة ← إبطال ذاكرة الواجهة.
 * الأحداث المتلاحقة (طلب يحجز عدة متغيّرات) تُجمع في نداء واحد كل ثانيتين.
 */
const TAGS: Record<string, string[]> = {
  product: ["products"],
  translation: ["products", "categories", "collections", "shipping-threshold"], // المرحلة 2: translation.created (التحديث عبر middlewares)
  "product-variant": ["products"],
  "product-option": ["products"],
  // M19: أسعار خيارات التوصيل (ومنها قاعدة المجاني) أسعار في وحدة التسعير
  price: ["products", "shipping-threshold"],
  "price-set": ["products", "shipping-threshold"],
  "price-rule": ["shipping-threshold"],
  // M26: قوائم الأسعار (تخفيضات اللوحة) تغيّر سعر المنتج المعروض
  "price-list": ["products"],
  "price-list-rule": ["products"],
  "shipping-option": ["shipping-threshold"],
  "inventory-level": ["products"],
  "inventory-item": ["products"],
  "reservation-item": ["products"],
  "product-category": ["categories", "products"],
  "product-collection": ["collections", "products"],
  region: ["regions", "products"],
}

export default async function revalidateStorefront({ event, container }: SubscriberArgs<{ id?: string }>) {
  const model = event.name.split(".")[0]
  queueRevalidate(TAGS[model] ?? [], container.resolve(ContainerRegistrationKeys.LOGGER))
}

export const config: SubscriberConfig = {
  event: Object.keys(TAGS).flatMap((m) => [`${m}.created`, `${m}.updated`, `${m}.deleted`]),
}
