import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { client } from "../../../../lib/client"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../modules/loyalty/service"

/** GET /admin/naqla/loyalty — قواعد الولاء من store.json + أعضاء كل مستوى + مجاميع النقاط */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client() as any
  const loyalty = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const customers = req.scope.resolve(Modules.CUSTOMER)
  const entries = await loyalty.listLoyaltyEntries({}, { take: 100000, select: ["customer_id", "kind", "status", "points", "code"] })
  const sum = (f: (e: any) => boolean) => entries.filter(f).reduce((s, e: any) => s + Number(e.points), 0)
  const groups = (await customers.listCustomerGroups({}, { take: 100, relations: ["customers"] })).filter((g) => (g.metadata as any)?.loyalty_tier)
  const members = Object.fromEntries(groups.map((g) => [(g.metadata as any).loyalty_tier, g.customers?.length ?? 0]))
  res.json({
    enabled: !!c.features?.loyalty,
    tiersEnabled: !!c.features?.loyaltyTiers,
    rules: { pointsPerUnit: c.loyalty.pointsPerUnit, redeemPoints: c.loyalty.redeemPoints, redeemValue: c.loyalty.redeemValue, currencyLabel: c.currencyLabel },
    tiers: c.loyalty.tiers.map((t: any) => ({ ...t, members: t.min === 0 ? null : members[t.key] ?? 0 })),
    totals: {
      members: new Set(entries.map((e: any) => e.customer_id)).size,
      pending: sum((e) => e.kind === "earn" && e.status === "pending"),
      available: Math.max(0, sum((e) => e.status === "available")),
      redeemedCodes: entries.filter((e: any) => e.kind === "redeem").length,
    },
    source: `clients/${c.slug}/store.json → loyalty`,
  })
}
