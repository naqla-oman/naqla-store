import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { featureOn } from "../../../../../lib/features"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../../modules/loyalty/service"
import { storeError } from "../../../../../lib/store-errors"

/** GET /store/customers/me/loyalty — الرصيدان (متاح/معلّق) والمستوى والسجل وأكواد الاستبدال */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  // M10: الولاء مُطفأ لهذا المتجر ← لا رصيد ولا استبدال
  if (!featureOn("loyalty")) throw storeError(MedusaError.Types.NOT_FOUND, "loyalty_disabled")
  const loyalty = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const s = await loyalty.summary(req.auth_context.actor_id)
  res.json({
    available: s.available,
    pending: s.pending,
    confirmed: s.confirmed,
    tier: s.tier,
    next_tier: s.next,
    // C1: قائمة صريحة — لا يُعاد كائن الإعدادات كما هو
    rules: {
      pointsPerUnit: s.rules.pointsPerUnit,
      redeemPoints: s.rules.redeemPoints,
      redeemValue: s.rules.redeemValue,
      tiers: s.rules.tiers.map((t) => ({ key: t.key, name: t.name, min: t.min })),
    },
    entries: s.entries.slice(0, 30).map((e) => ({
      id: e.id,
      kind: e.kind,
      status: e.status,
      points: e.points,
      order_display_id: e.order_display_id,
      code: e.code,
      created_at: e.created_at,
    })),
  })
}
