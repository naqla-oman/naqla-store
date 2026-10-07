import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { featureOn } from "../../../../../../lib/features"
import { Modules } from "@medusajs/framework/utils"
import { redeemPointsWorkflow } from "../../../../../../workflows/loyalty"
import { storeError } from "../../../../../../lib/store-errors"

/** POST /store/customers/me/loyalty/redeem — استبدال 500 نقطة متاحة بكود خصم 5 ر.ع لاستخدام واحد */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  // M10: الولاء مُطفأ لهذا المتجر ← لا رصيد ولا استبدال
  if (!featureOn("loyalty")) throw storeError(MedusaError.Types.NOT_FOUND, "loyalty_disabled")
  const [store] = await req.scope.resolve(Modules.STORE).listStores({}, { relations: ["supported_currencies"] })
  const currency = store?.supported_currencies?.find((c) => c.is_default)?.currency_code ?? "omr"
  const { result } = await redeemPointsWorkflow(req.scope).run({
    input: { customer_id: req.auth_context.actor_id, currency },
  })
  res.status(201).json({ code: result.code })
}
