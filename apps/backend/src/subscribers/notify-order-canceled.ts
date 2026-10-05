import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyOrder } from "../lib/order-notifications"

/** M14: واتساب للزبونة عند إلغاء الطلب */
export default async function notifyCanceled({ event: { data }, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  await notifyOrder(container, data.id, "order_canceled", data.id)
}

export const config: SubscriberConfig = { event: "order.canceled" }
