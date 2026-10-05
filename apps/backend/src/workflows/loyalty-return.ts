import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { LOYALTY_MODULE } from "../modules/loyalty"
import type LoyaltyModuleService from "../modules/loyalty/service"

/**
 * M9: نقاط الطلب بعد الإرجاع = نقاط item_total الصافي (Medusa يخصم المرتجعات المستلمة منه).
 * تُحسب من الصفر في كل مرة فتصح مع الإرجاع الجزئي والمتكرر.
 */
type Input = { order_id: string }

const recalcStep = createStep("recalc", async ({ order_id }: Input, { container }) => {
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const [entry] = await loyalty.listLoyaltyEntries({ order_id, kind: "earn" }, { take: 1 })
  if (!entry) return new StepResponse(null, null)
  // Medusa يخصم المرتجعات المستلمة من item_total للطلب — فهو صافي ما احتفظت به الزبونة بعد الخصومات.
  // النقاط = نقاط item_total الحالي (نفس معادلة الكسب الأصلي) — لا نضرب في حصة ثانية (كان خصماً مزدوجاً)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "status", "item_total", "fulfillments.delivered_at", "fulfillments.canceled_at"],
    filters: { id: order_id },
  })
  const o: any = data[0]
  const kept = Math.max(0, Number(o?.item_total ?? 0))
  const delivered = ((o?.fulfillments ?? []) as any[]).some((f) => f.delivered_at && !f.canceled_at)
  const points = await loyalty.pointsFor(kept)
  const before = { id: entry.id, points: entry.points, status: entry.status }
  if (points === Number(entry.points)) return new StepResponse({ customer_id: entry.customer_id, points, changed: false }, null)
  await loyalty.updateLoyaltyEntries({
    id: entry.id,
    points,
    // ملغاة عند إرجاع الكل؛ وإلا حالة الطلب (متاحة إن سُلِّم، معلّقة قبله) — لا تبقى ملغاة إن لم يُلغَ الطلب
    status: points === 0 ? "canceled" : entry.status !== "canceled" ? entry.status : o?.status === "canceled" ? "canceled" : delivered ? "available" : "pending",
    note: `بعد الإرجاع: ${points} نقطة (كانت ${entry.points})`,
  } as any)
  return new StepResponse({ customer_id: entry.customer_id, points, changed: true }, before)
}, async (before, { container }) => {
  if (before) await container.resolve<LoyaltyModuleService>(LOYALTY_MODULE).updateLoyaltyEntries(before as any)
})

export const recalcPointsAfterReturnWorkflow = createWorkflow("recalc-points-after-return", (input: Input) => {
  return new WorkflowResponse(recalcStep(input))
})
