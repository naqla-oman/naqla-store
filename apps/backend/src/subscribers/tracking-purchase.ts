import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderServerEvent } from "../lib/order-server-event"

/** حدث الشراء من الخادم (CAPI/Events API/MP) — يكمّل حدث المتصفح بنفس event_id */
export default async function trackPurchase({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await sendOrderServerEvent(container, data.id, "purchase")
}

export const config: SubscriberConfig = { event: "order.placed" }
