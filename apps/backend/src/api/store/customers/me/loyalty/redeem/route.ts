import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { redeemPointsWorkflow } from "../../../../../../workflows/loyalty"

/** POST /store/customers/me/loyalty/redeem — استبدال 500 نقطة متاحة بكود خصم 5 ر.ع لاستخدام واحد */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const [store] = await req.scope.resolve(Modules.STORE).listStores({}, { relations: ["supported_currencies"] })
  const currency = store?.supported_currencies?.find((c) => c.is_default)?.currency_code ?? "omr"
  const { result } = await redeemPointsWorkflow(req.scope).run({
    input: { customer_id: req.auth_context.actor_id, currency },
  })
  res.status(201).json({ code: result.code })
}
