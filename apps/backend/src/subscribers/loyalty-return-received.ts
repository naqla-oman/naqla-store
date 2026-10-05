import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { featureOn } from "../lib/features"
import { recalcPointsAfterReturnWorkflow } from "../workflows/loyalty-return"
import { syncLoyaltyTierWorkflow } from "../workflows/sync-loyalty-tier"

/** M9: استلام مرتجع ← خصم نقاط القطع المرتجعة، ثم مزامنة المستوى */
export default async function onReturnReceived({ event: { data }, container }: SubscriberArgs<{ order_id: string; return_id?: string }>) {
  if (!featureOn("loyalty")) return // M10
  const { result } = await recalcPointsAfterReturnWorkflow(container).run({ input: { order_id: data.order_id } })
  if (result?.changed && result.customer_id) await syncLoyaltyTierWorkflow(container).run({ input: { customer_id: result.customer_id } })
}

export const config: SubscriberConfig = { event: "order.return_received" }
