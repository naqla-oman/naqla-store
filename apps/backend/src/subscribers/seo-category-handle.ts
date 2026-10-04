import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { syncHandle } from "../lib/seo-handles"

/** تغيير رابط قسم ← تحويل 301 تلقائي من الرابط القديم */
export default async function categoryHandle({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await syncHandle(container, "category", data.id)
}

export const config: SubscriberConfig = { event: ["product-category.updated", "product-category.created"] }
