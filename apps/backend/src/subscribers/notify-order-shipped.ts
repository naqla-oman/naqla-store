import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyOrder, orderOfFulfillment } from "../lib/order-notifications"

/** واتساب: خرج للتوصيل (أو «جاهز للاستلام» لطلبات الاستلام من المشغل) */
export default async function notifyShipped({ event: { data }, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  const found = await orderOfFulfillment(container, data.id)
  if (!found) return
  await notifyOrder(container, found.orderId, found.shippingCode === "pickup" ? "order_ready_pickup" : "order_shipped", data.id)
}

export const config: SubscriberConfig = { event: "shipment.created" }
