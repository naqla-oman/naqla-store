import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyOrder } from "../lib/order-notifications"

/** واتساب: تم استلام الطلب */
export default async function notifyPlaced({ event: { data }, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  await notifyOrder(container, data.id, "order_placed", data.id)
}

export const config: SubscriberConfig = { event: "order.placed" }
