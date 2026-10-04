import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { awardOrderPointsWorkflow } from "../workflows/loyalty"

/** نقاط الطلب تُحتسب فور الطلب بحالة «معلّقة» (لزبونات الحساب فقط) */
export default async function onOrderPlaced({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await awardOrderPointsWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = { event: "order.placed" }
