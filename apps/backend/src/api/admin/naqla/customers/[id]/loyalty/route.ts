import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminLang, clientIn } from "../../../../../../lib/admin-i18n"
import { client } from "../../../../../../lib/client"
import { LOYALTY_MODULE } from "../../../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../../../modules/loyalty/service"

/** M32: نقاط زبونة واحدة لويدجت صفحة الزبونة في اللوحة */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client() as any
  if (!c.features?.loyalty) return res.json({ enabled: false })
  const s: any = await req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE).summary(req.params.id)
  // اسم المستوى بلغة اللوحة (المرحلة 5)
  const tier = s.tier ? ((clientIn(adminLang(req)) as any).loyalty?.tiers?.find((t: any) => t.key === s.tier.key)?.name ?? s.tier.name) : null
  res.json({ enabled: true, available: s.available ?? 0, pending: s.pending ?? 0, tier })
}
