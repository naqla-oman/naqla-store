import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { claimOrdersByPhone } from "../../../lib/claim-orders"

export const PLACEHOLDER_EMAIL_DOMAIN = "phone.invalid"

type Body = { first_name?: string; last_name?: string; email?: string }

/**
 * POST /store/phone-account — إنشاء حساب الزبونة بعد التحقق برمز واتساب.
 * يتطلب رمز تسجيل (هوية phone-auth بلا زبونة بعد). الهاتف يُؤخذ من الهوية الموثّقة لا من الطلب.
 * ثم تُنسب طلبات الضيف السابقة بنفس الرقم إلى الحساب.
 */
export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const { auth_identity_id, actor_id } = req.auth_context
  if (actor_id) throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "الحساب موجود مسبقاً")

  const auth = req.scope.resolve(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(auth_identity_id, { relations: ["provider_identities"] })
  const phone = identity.provider_identities?.find((p) => p.provider === "phone-auth")?.entity_id
  if (!phone) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "تحققي من رقمك أولاً")

  const first = (req.body.first_name ?? "").trim().slice(0, 60)
  if (!first) throw new MedusaError(MedusaError.Types.INVALID_DATA, "أدخلي اسمك")
  const email = (req.body.email ?? "").trim().toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "البريد الإلكتروني غير صحيح")
  }

  const { result: customer } = await createCustomerAccountWorkflow(req.scope).run({
    input: {
      authIdentityId: auth_identity_id,
      customerData: {
        first_name: first,
        last_name: (req.body.last_name ?? "").trim().slice(0, 60) || null,
        phone,
        // createCustomerAccountWorkflow يشترط بريداً؛ عند غيابه نستخدم نطاق .invalid المحجوز (RFC 2606)
        // فلا يمكن أن يصل لأي شخص، والواجهة تخفيه (PLACEHOLDER_EMAIL_DOMAIN)
        email: email || `${phone.replace(/\D/g, "")}@${PLACEHOLDER_EMAIL_DOMAIN}`,
      },
    },
  })

  const claimed = await claimOrdersByPhone(req.scope, customer.id, phone)
  res.status(201).json({ customer, claimed_orders: claimed.length })
}
