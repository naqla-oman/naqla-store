import crypto from "crypto"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { LOYALTY_MODULE } from "../modules/loyalty"
import type LoyaltyModuleService from "../modules/loyalty/service"

/* ============ احتساب نقاط طلب ============ */

type OrderInput = { order_id: string }

/**
 * يُنشئ قيد نقاط للطلب إن كان لزبونة لها حساب (مرة واحدة لكل طلب).
 * الحالة: canceled إن أُلغي، available إن سُلِّم، وإلا pending حتى التوصيل.
 */
const awardOrderPointsStep = createStep("award-order-points", async ({ order_id }: OrderInput, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)

  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "status", "item_total", "customer_id", "customer.has_account", "fulfillments.delivered_at"],
    filters: { id: order_id },
  })
  const order: any = data[0]
  if (!order?.customer_id || !order.customer?.has_account) return new StepResponse<any, string | undefined>(null, undefined)

  const [existing] = await loyalty.listLoyaltyEntries({ order_id, kind: "earn" })
  if (existing) return new StepResponse<any, string | undefined>(existing, undefined)

  const points = await loyalty.pointsFor(order.item_total)
  if (!points) return new StepResponse<any, string | undefined>(null, undefined)

  const delivered = (order.fulfillments ?? []).some((f: any) => f.delivered_at)
  const entry = await loyalty.createLoyaltyEntries({
    customer_id: order.customer_id,
    order_id,
    order_display_id: order.display_id,
    kind: "earn",
    status: order.status === "canceled" ? "canceled" : delivered ? "available" : "pending",
    points,
  })
  return new StepResponse<any, string | undefined>(entry, entry.id)
}, async (id, { container }) => {
  if (id) await container.resolve<LoyaltyModuleService>(LOYALTY_MODULE).deleteLoyaltyEntries(id)
})

export const awardOrderPointsWorkflow = createWorkflow("award-order-points", (input: OrderInput) => {
  return new WorkflowResponse(awardOrderPointsStep(input))
})

/* ============ تغيير حالة نقاط طلب (توصيل / إلغاء) ============ */

type StatusInput = { order_id: string; status: "available" | "canceled" }

const setOrderPointsStatusStep = createStep("set-order-points-status", async ({ order_id, status }: StatusInput, { container }) => {
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const [entry] = await loyalty.listLoyaltyEntries({ order_id, kind: "earn" })
  // لا نعيد تفعيل نقاط طلب ملغى، ولا نعدّل ما هو بالحالة المطلوبة
  if (!entry || entry.status === status || entry.status === "canceled") {
    return new StepResponse<any, { id: string; prev: string } | undefined>(null, undefined)
  }
  const prev = entry.status
  await loyalty.updateLoyaltyEntries({ id: entry.id, status })
  return new StepResponse<any, { id: string; prev: string } | undefined>({ id: entry.id, status, customer_id: entry.customer_id }, { id: entry.id, prev })
}, async (comp, { container }) => {
  if (comp) await container.resolve<LoyaltyModuleService>(LOYALTY_MODULE).updateLoyaltyEntries({ id: comp.id, status: comp.prev as any })
})

export const setOrderPointsStatusWorkflow = createWorkflow("set-order-points-status", (input: StatusInput) => {
  return new WorkflowResponse(setOrderPointsStatusStep(input))
})

/* ============ استبدال النقاط بكود خصم ============ */

type RedeemInput = { customer_id: string }

const checkBalanceStep = createStep("check-balance", async ({ customer_id }: RedeemInput, { container }) => {
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const { available } = await loyalty.summary(customer_id)
  const { redeemPoints, redeemValue } = loyalty.options
  if (available < redeemPoints) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `تحتاجين ${redeemPoints} نقطة متاحة — رصيدك ${available}`)
  }
  return new StepResponse({ redeemPoints, redeemValue })
})

const createRedeemPromotionStep = createStep(
  "create-redeem-promotion",
  async (input: { redeemValue: number; currency: string; customer_id: string }, { container }) => {
    const promotion = container.resolve(Modules.PROMOTION)
    const code = `LNP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
    const [promo] = await promotion.createPromotions([
      {
        code,
        type: "standard",
        status: "active",
        is_automatic: false,
        is_tax_inclusive: true,
        limit: 1, // يُستخدم مرة واحدة
        // M8: الكود لصاحبته فقط — Medusa يرفضه في سلة أي زبونة أخرى
        rules: [{ attribute: "customer.id", operator: "eq", values: [input.customer_id] }],
        application_method: {
          type: "fixed",
          target_type: "order",
          allocation: "across",
          value: input.redeemValue,
          currency_code: input.currency,
          description: "استبدال نقاط الولاء",
        },
      } as any,
    ])
    return new StepResponse({ id: promo.id, code }, promo.id)
  },
  async (id, { container }) => {
    if (id) await container.resolve(Modules.PROMOTION).deletePromotions(id)
  }
)

const recordRedeemStep = createStep(
  "record-redeem",
  async (input: { customer_id: string; points: number; code: string }, { container }) => {
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
    const entry = await loyalty.createLoyaltyEntries({
      customer_id: input.customer_id,
      kind: "redeem",
      status: "available",
      points: -input.points,
      code: input.code,
      note: "استبدال بكود خصم",
    })
    // C4 (خط دفاع ثانٍ): الرصيد بعد الخصم لا يكون سالباً — وإلا يُلغى القيد والكود بالتعويض
    const raw = (await loyalty.listLoyaltyEntries({ customer_id: input.customer_id, status: "available" }, { take: 100000, select: ["points"] }))
      .reduce((sum, e) => sum + Number(e.points), 0)
    if (raw < 0) {
      await loyalty.deleteLoyaltyEntries(entry.id)
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "الرصيد لا يكفي للاستبدال")
    }
    return new StepResponse(entry, entry.id)
  },
  async (id, { container }) => {
    if (id) await container.resolve<LoyaltyModuleService>(LOYALTY_MODULE).deleteLoyaltyEntries(id)
  }
)

export const redeemPointsWorkflow = createWorkflow("redeem-points", (input: RedeemInput & { currency: string }) => {
  // C4: قفل لكل زبونة — الطلبات المتوازية تُنفَّذ بالتتابع، والرصيد يُعاد حسابه داخل القفل
  const lockKey = transform({ input }, ({ input }) => `loyalty:${input.customer_id}`)
  acquireLockStep({ key: lockKey, timeout: 15, ttl: 30 })
  const rules = checkBalanceStep({ customer_id: input.customer_id })
  const promo = createRedeemPromotionStep({ redeemValue: rules.redeemValue, currency: input.currency, customer_id: input.customer_id })
  const entry = recordRedeemStep({ customer_id: input.customer_id, points: rules.redeemPoints, code: promo.code })
  releaseLockStep({ key: lockKey })
  return new WorkflowResponse({ code: promo.code, entry })
})


/**
 * M8: إلغاء طلب استُخدم فيه كود استبدال ← تُلغى قيدة الخصم فتعود النقاط للرصيد.
 * الكود نفسه استُخدم مرة (limit: 1) فلا يُعاد تفعيله؛ تستبدل الزبونة من جديد.
 */
const restoreRedeemStep = createStep(
  "restore-redeem",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "customer_id", "items.adjustments.code"],
      filters: { id: input.order_id },
    })
    const o: any = data[0]
    const codes = [...new Set(((o?.items ?? []) as any[]).flatMap((i) => (i.adjustments ?? []).map((a: any) => a.code)).filter(Boolean))]
    if (!o?.customer_id || !codes.length) return new StepResponse([] as string[], [] as string[])
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
    const entries = await loyalty.listLoyaltyEntries({ customer_id: o.customer_id, kind: "redeem", code: codes, status: "available" } as any, { take: 20 })
    for (const e of entries) {
      await loyalty.updateLoyaltyEntries({ id: e.id, status: "canceled", note: `أُعيدت النقاط — أُلغي الطلب الذي استُخدم فيه الكود ${e.code}` } as any)
    }
    return new StepResponse(entries.map((e) => e.code as string), entries.map((e) => e.id))
  },
  async (ids, { container }) => {
    if (ids?.length) {
      const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
      for (const id of ids) await loyalty.updateLoyaltyEntries({ id, status: "available" } as any)
    }
  }
)

export const restoreRedeemOnCancelWorkflow = createWorkflow("restore-redeem-on-cancel", (input: { order_id: string }) => {
  return new WorkflowResponse(restoreRedeemStep(input))
})
