import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "../../../../../../lib/client"
import { LOYALTY_MODULE } from "../../../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../../../modules/loyalty/service"

/** M32: نقاط زبونة واحدة لويدجت صفحة الزبونة في اللوحة */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client() as any
  if (!c.features?.loyalty) return res.json({ enabled: false })
  const s: any = await req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE).summary(req.params.id)
  res.json({ enabled: true, available: s.available ?? 0, pending: s.pending ?? 0, tier: s.tier?.name ?? null })
}
