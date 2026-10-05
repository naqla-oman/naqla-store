import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { client } from "../../../../lib/client"
import { memo } from "../../../../lib/memo"

/**
 * GET /admin/naqla/loyalty — قواعد الولاء من store.json + أعضاء كل مستوى + مجاميع النقاط.
 * M31: SQL مجمّع (كان يحمّل حتى 100000 قيد ثم يجمع في الذاكرة) مع ذاكرة 60 ثانية.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client() as any
  const body = await memo(`loyalty:${c.slug}`, 60_000, async () => {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const [t] = (await pg.raw(`select count(distinct customer_id) as members,
        coalesce(sum(points) filter (where kind = 'earn' and status = 'pending'), 0) as pending,
        coalesce(sum(points) filter (where status = 'available'), 0) as available,
        count(*) filter (where kind = 'redeem') as redeemed
      from loyalty_entry where deleted_at is null`)).rows
    const groups = (await pg.raw(`select cg.metadata->>'loyalty_tier' as tier, count(cgc.customer_id) as n
        from customer_group cg
        left join customer_group_customer cgc on cgc.customer_group_id = cg.id and cgc.deleted_at is null
       where cg.deleted_at is null and cg.metadata->>'loyalty_tier' is not null group by 1`)).rows as any[]
    const members = Object.fromEntries(groups.map((g) => [g.tier, Number(g.n)]))
    return {
      enabled: !!c.features?.loyalty,
      tiersEnabled: !!c.features?.loyaltyTiers,
      rules: { pointsPerUnit: c.loyalty.pointsPerUnit, redeemPoints: c.loyalty.redeemPoints, redeemValue: c.loyalty.redeemValue, currencyLabel: c.currencyLabel },
      tiers: c.loyalty.tiers.map((x: any) => ({ ...x, members: x.min === 0 ? null : members[x.key] ?? 0 })),
      totals: {
        members: Number(t.members),
        pending: Number(t.pending),
        available: Math.max(0, Number(t.available)),
        redeemedCodes: Number(t.redeemed),
      },
      source: `clients/${c.slug}/store.json → loyalty`,
    }
  })
  res.json(body)
}
