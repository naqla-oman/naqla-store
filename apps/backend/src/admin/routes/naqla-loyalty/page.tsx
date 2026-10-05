import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Gift } from "@medusajs/icons"
import { Badge, Text } from "@medusajs/ui"
import { Card, Kpi, PageHead, useNaqla } from "../../components/naqla-ui"

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
  const { data: d, error } = useNaqla<L>("/admin/naqla/loyalty")
  return (
    <div className="flex flex-col gap-y-3" dir="rtl" data-testid="naqla-loyalty">
      <PageHead title="إعدادات الولاء" sub="النقاط معلّقة حتى التوصيل، ثم متاحة للاستبدال؛ والمستوى من النقاط المؤكَّدة">
        {d && <Badge color={d.enabled ? "green" : "grey"}>{d.enabled ? "البرنامج مفعّل" : "البرنامج مُطفأ"}</Badge>}
      </PageHead>
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi label="الكسب" value={`${d.rules.pointsPerUnit} نقاط`} hint={`لكل 1 ${d.rules.currencyLabel}`} />
            <Kpi label="الاستبدال" value={`${d.rules.redeemPoints} نقطة`} hint={`= كود خصم ${d.rules.redeemValue} ${d.rules.currencyLabel} لاستخدام واحد`} tone="navy" />
            <Kpi label="نقاط معلّقة" value={d.totals.pending} hint={`لدى ${d.totals.members} زبوناً`} tone="gold" />
            <Kpi label="نقاط متاحة" value={d.totals.available} hint={`${d.totals.redeemedCodes} كود استُبدل`} tone="green" />
          </div>
          <Card title="المستويات" testid="loyalty-tiers">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {d.tiers.map((t) => (
                <div key={t.key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Text weight="plus">{t.name}</Text>
                    <Text size="xsmall" className="text-ui-fg-muted">{t.min ? `من ${t.min} نقطة مؤكَّدة` : "للجميع"}</Text>
                  </div>
                  <Text size="small" className="mt-2">{t.perk || "—"}</Text>
                  {t.members !== null && <Text size="xsmall" className="mt-2 text-ui-fg-subtle">{t.members} أعضاء في «{t.group}» (انضمام تلقائي)</Text>}
                </div>
              ))}
            </div>
            {!d.tiersEnabled && <Text size="small" className="mt-3 text-ui-fg-muted">المستويات مُطفأة لهذا المتجر.</Text>}
          </Card>
          <Text size="xsmall" className="px-1 text-ui-fg-muted">لتعديل القواعد أو المستويات أو الامتيازات تواصل مع نقلة — تُضبط في <span dir="ltr">{d.source}</span>.</Text>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "إعدادات الولاء", icon: Gift, rank: 3 })
export default LoyaltyPage
