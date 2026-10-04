import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyOrder, orderOfFulfillment } from "../lib/order-notifications"

/** واتساب: تم التوصيل */
export default async function notifyDelivered({ event: { data }, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  const found = await orderOfFulfillment(container, data.id)
  if (!found) return
  await notifyOrder(container, found.orderId, "order_delivered", data.id)
}

export const config: SubscriberConfig = { event: "delivery.created" }
