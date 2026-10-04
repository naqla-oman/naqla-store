import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { awardOrderPointsWorkflow } from "../../../../../workflows/loyalty"
import { syncLoyaltyTierWorkflow } from "../../../../../workflows/sync-loyalty-tier"
import { claimOrdersByPhone } from "../../../../../lib/claim-orders"

/** POST /store/customers/me/claim-orders — بعد كل دخول: نسب طلبات الضيف الجديدة بنفس الرقم */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  if (!customer.phone) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "لا يوجد رقم هاتف في الحساب")
  const claimed = await claimOrdersByPhone(req.scope, customer.id, customer.phone)
  // استكمال نقاط طلبات الحساب التي لا قيد لها (آمن للتكرار: فهرس فريد لكل طلب)
  const { data: orders } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id"],
    filters: { customer_id: customer.id },
  })
  for (const o of orders) {
    await awardOrderPointsWorkflow(req.scope).run({ input: { order_id: o.id } })
  }
  // الطلبات المنسوبة المسلَّمة تضيف نقاطاً مؤكَّدة قد ترفع المستوى
  await syncLoyaltyTierWorkflow(req.scope).run({ input: { customer_id: customer.id } })
  res.json({ claimed_orders: claimed.length })
}
