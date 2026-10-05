import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyOrder, orderOfFulfillment } from "../lib/order-notifications"

/** واتساب: خرج للتوصيل (أو «جاهز للاستلام» لطلبات الاستلام من المشغل) */
export default async function notifyShipped({ event: { data }, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  const found = await orderOfFulfillment(container, data.id)
  if (!found) return
  if (found.shippingCode === "pickup") return notifyOrder(container, found.orderId, "order_ready_pickup", data.id)
  // M20: شحنة عبر شركة (بوليصة) ← قالب برقمها ورابطها؛ وإلا «خرج للتوصيل» بمندوب المتجر
  if (found.awb) return notifyOrder(container, found.orderId, "order_shipped_courier", data.id, { awb: found.awb, awbUrl: found.awbUrl ?? undefined })
  await notifyOrder(container, found.orderId, "order_shipped", data.id)
}

export const config: SubscriberConfig = { event: "shipment.created" }
