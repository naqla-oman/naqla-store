import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { featureOn } from "../lib/features"
import { awardOrderPointsWorkflow } from "../workflows/loyalty"

/** نقاط الطلب تُحتسب فور الطلب بحالة «معلّقة» (لزبونات الحساب فقط) */
export default async function onOrderPlaced({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  if (!featureOn("loyalty")) return // M10
  await awardOrderPointsWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = { event: "order.placed" }
