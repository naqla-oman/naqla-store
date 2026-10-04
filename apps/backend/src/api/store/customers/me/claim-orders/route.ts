import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { claimOrdersByPhone } from "../../../../../lib/claim-orders"

/** POST /store/customers/me/claim-orders — بعد كل دخول: نسب طلبات الضيف الجديدة بنفس الرقم */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  if (!customer.phone) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "لا يوجد رقم هاتف في الحساب")
  const claimed = await claimOrdersByPhone(req.scope, customer.id, customer.phone)
  res.json({ claimed_orders: claimed.length })
}
