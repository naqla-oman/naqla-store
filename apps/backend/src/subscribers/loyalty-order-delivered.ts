import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { setOrderPointsStatusWorkflow } from "../workflows/loyalty"

/** عند تسجيل التوصيل في اللوحة: تتحول نقاط الطلب إلى «متاحة» */
export default async function onDelivered({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // الحدث يحمل معرّف التنفيذ (fulfillment)، فنصل منه إلى الطلب عبر جدول الربط
  const { data: links } = await query.graph({
    entity: "order_fulfillment",
    fields: ["order_id", "fulfillment_id"],
    filters: { fulfillment_id: data.id },
  })
  const orderId = (links[0] as any)?.order_id
  if (!orderId) return
  await setOrderPointsStatusWorkflow(container).run({ input: { order_id: orderId, status: "available" } })
}

export const config: SubscriberConfig = { event: "delivery.created" }
