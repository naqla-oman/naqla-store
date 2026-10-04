import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { PLACEHOLDER_EMAIL_DOMAIN } from "../../../phone-account/route"

/**
 * POST /store/customers/me/email { email, only_if_placeholder? }
 * يضع البريد الحقيقي للزبونة. مع only_if_placeholder (من صفحة الدفع) لا يستبدل إلا البريد المحجوز.
 */
export const POST = async (req: AuthenticatedMedusaRequest<{ email?: string; only_if_placeholder?: boolean }>, res: MedusaResponse) => {
  const email = String(req.body.email ?? "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "البريد الإلكتروني غير صحيح")
  }
  const customers = req.scope.resolve(Modules.CUSTOMER)
  const me = await customers.retrieveCustomer(req.auth_context.actor_id)
  if (req.body.only_if_placeholder && !me.email?.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)) {
    return res.json({ updated: false })
  }
  const [taken] = await customers.listCustomers({ email, has_account: true })
  if (taken && taken.id !== me.id) {
    throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "هذا البريد مستخدم في حساب آخر")
  }
  await customers.updateCustomers(me.id, { email })
  res.json({ updated: true })
}
