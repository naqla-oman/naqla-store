import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Gift } from "@medusajs/icons"
import { Badge, Text } from "@medusajs/ui"
import { Card, Kpi, PageHead, useCount, useNaqla } from "../../components/naqla-ui"
import { Data, useNaqlaT } from "../../lib/naqla-i18n"

type L = {
  enabled: boolean
  tiersEnabled: boolean
  rules: { pointsPerUnit: number; redeemPoints: number; redeemValue: number; currencyLabel: string }
  tiers: { key: string; name: string; min: number; perk?: string; group?: string; members: number | null }[]
  totals: { members: number; pending: number; available: number; redeemedCodes: number }
  source: string
}

/** إعدادات الولاء: القواعد والمستويات وأعضاؤها (القواعد تُضبط في store.json من نقلة) */
const LoyaltyPage = () => {
  const { t } = useNaqlaT()
  const count = useCount()
  const { data: d, error } = useNaqla<L>("/admin/naqla/loyalty")
  return (
    <div className="flex flex-col gap-y-3" data-testid="naqla-loyalty">
      <PageHead title={t("loyalty.title")} sub={t("loyalty.sub")}>
        {d && <Badge color={d.enabled ? "green" : "grey"}>{t(d.enabled ? "loyalty.on" : "loyalty.off")}</Badge>}
      </PageHead>
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi label={t("loyalty.earn")} value={t("loyalty.earnValue", { n: d.rules.pointsPerUnit })} hint={t("loyalty.perUnit", { cur: d.rules.currencyLabel })} />
            <Kpi label={t("loyalty.redeem")} value={t("loyalty.redeemValue", { n: d.rules.redeemPoints })} hint={t("loyalty.redeemHint", { value: d.rules.redeemValue, cur: d.rules.currencyLabel })} tone="navy" />
            <Kpi label={t("loyalty.pending")} value={d.totals.pending} hint={d.totals.members ? t("loyalty.heldBy", { who: count(d.totals.members, "customers") }) : t("loyalty.noPending")} tone="gold" />
            <Kpi label={t("loyalty.available")} value={d.totals.available} hint={count(d.totals.redeemedCodes, "codes")} tone="green" />
          </div>
          <Card title={t("loyalty.tiers")} testid="loyalty-tiers">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {d.tiers.map((tier) => (
                <div key={tier.key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Text weight="plus"><Data>{tier.name}</Data></Text>
                    <Text size="xsmall" className="text-ui-fg-muted">{tier.min ? t("loyalty.from", { n: tier.min }) : t("loyalty.everyone")}</Text>
                  </div>
                  <Text size="small" className="mt-2">{tier.perk ? <Data>{tier.perk}</Data> : "—"}</Text>
                  {tier.members !== null && <Text size="xsmall" className="mt-2 text-ui-fg-subtle">{t("loyalty.inGroup", { who: count(tier.members, "members") })}<Data>{tier.group}</Data>{t("loyalty.autoJoin")}</Text>}
                </div>
              ))}
            </div>
            {!d.tiersEnabled && <Text size="small" className="mt-3 text-ui-fg-muted">{t("loyalty.tiersOff")}</Text>}
          </Card>
          <Text size="xsmall" className="px-1 text-ui-fg-muted">{t("loyalty.contact")}</Text>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "naqla.nav.loyalty", translationNs: "translation", icon: Gift, rank: 3 })
export default LoyaltyPage
