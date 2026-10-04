import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { setOrderPointsStatusWorkflow } from "../workflows/loyalty"
import { syncLoyaltyTierWorkflow } from "../workflows/sync-loyalty-tier"

/** إلغاء الطلب يلغي نقاطه تلقائياً */
export default async function onCanceled({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const { result } = await setOrderPointsStatusWorkflow(container).run({ input: { order_id: data.id, status: "canceled" } })
  // تغيّر النقاط المؤكَّدة قد يغيّر المستوى ومجموعته (الانضمام أو الخروج تلقائياً)
  if (result?.customer_id) await syncLoyaltyTierWorkflow(container).run({ input: { customer_id: result.customer_id } })
}

export const config: SubscriberConfig = { event: "order.canceled" }
