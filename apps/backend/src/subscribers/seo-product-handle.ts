import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { syncHandle } from "../lib/seo-handles"

/** تغيير رابط منتج ← تحويل 301 تلقائي من الرابط القديم */
export default async function productHandle({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await syncHandle(container, "product", data.id)
}

export const config: SubscriberConfig = { event: ["product.updated", "product.created"] }
