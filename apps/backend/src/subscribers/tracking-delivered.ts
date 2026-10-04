import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { orderOfFulfillment } from "../lib/order-notifications"
import { sendOrderServerEvent } from "../lib/order-server-event"

/**
 * حدث مخصص OrderDelivered بالقيمة عند تسجيل التوصيل: يتيح تحسين الإعلانات على الطلبات التي وصلت ودُفعت فعلاً
 * (مهم مع الدفع عند الاستلام حيث كثير من «المشتريات» لا تكتمل).
 */
export default async function trackDelivered({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const found = await orderOfFulfillment(container, data.id)
  if (found) await sendOrderServerEvent(container, found.orderId, "order_delivered")
}

export const config: SubscriberConfig = { event: "delivery.created" }
