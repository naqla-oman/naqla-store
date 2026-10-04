import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { setOrderPointsStatusWorkflow } from "../workflows/loyalty"

/** إلغاء الطلب يلغي نقاطه تلقائياً */
export default async function onCanceled({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await setOrderPointsStatusWorkflow(container).run({ input: { order_id: data.id, status: "canceled" } })
}

export const config: SubscriberConfig = { event: "order.canceled" }
