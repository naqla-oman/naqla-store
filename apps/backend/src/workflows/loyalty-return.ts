import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { LOYALTY_MODULE } from "../modules/loyalty"
import type LoyaltyModuleService from "../modules/loyalty/service"

/**
 * M9: نقاط الطلب بعد الإرجاع = قيمة ما احتفظت به الزبونة × معدل الكسب.
 * تُحسب من الصفر في كل مرة (return_received_quantity لكل سطر) فتصح مع الإرجاع الجزئي والمتكرر.
 */
type Input = { order_id: string }

const recalcStep = createStep("recalc", async ({ order_id }: Input, { container }) => {
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const [entry] = await loyalty.listLoyaltyEntries({ order_id, kind: "earn" }, { take: 1 })
  if (!entry) return new StepResponse(null, null)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.quantity", "items.total", "items.detail.return_received_quantity"],
    filters: { id: order_id },
  })
  const kept = (((data[0] as any)?.items ?? []) as any[]).reduce((sum, i) => {
    const q = Number(i.quantity) || 0
    const back = Math.min(q, Number(i.detail?.return_received_quantity ?? 0))
    return q ? sum + (Number(i.total) / q) * (q - back) : sum
  }, 0)
  const points = await loyalty.pointsFor(kept)
  const before = { id: entry.id, points: entry.points, status: entry.status }
  if (points === Number(entry.points)) return new StepResponse({ customer_id: entry.customer_id, points, changed: false }, null)
  await loyalty.updateLoyaltyEntries({
    id: entry.id,
    points,
    status: points === 0 ? "canceled" : entry.status,
    note: `بعد الإرجاع: ${points} نقطة (كانت ${entry.points})`,
  } as any)
  return new StepResponse({ customer_id: entry.customer_id, points, changed: true }, before)
}, async (before, { container }) => {
  if (before) await container.resolve<LoyaltyModuleService>(LOYALTY_MODULE).updateLoyaltyEntries(before as any)
})

export const recalcPointsAfterReturnWorkflow = createWorkflow("recalc-points-after-return", (input: Input) => {
  return new WorkflowResponse(recalcStep(input))
})
