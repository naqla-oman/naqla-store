import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { orderOfFulfillment } from "../lib/order-notifications"
import { sendOrderServerEvent } from "../lib/order-server-event"
import { isFullyDelivered } from "../lib/delivery"

/**
 * حدث مخصص OrderDelivered بالقيمة عند تسجيل التوصيل: يتيح تحسين الإعلانات على الطلبات التي وصلت ودُفعت فعلاً
 * (مهم مع الدفع عند الاستلام حيث كثير من «المشتريات» لا تكتمل).
 */
export default async function trackDelivered({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const found = await orderOfFulfillment(container, data.id)
  // منخفضة: OrderDelivered مرة واحدة حين يكتمل التسليم (التسليم الجزئي لا يُطلقه)
  if (found && (await isFullyDelivered(container, found.orderId))) await sendOrderServerEvent(container, found.orderId, "order_delivered")
}

export const config: SubscriberConfig = { event: "delivery.created" }
