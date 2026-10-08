import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartPie } from "@medusajs/icons"
import { Badge, Text } from "@medusajs/ui"
import { BarList, Card, Kpi, money, PageHead, useCount, useNaqla } from "../../components/naqla-ui"
import { Data, useNaqlaT } from "../../lib/naqla-i18n"

type Dash = {
  currencyLabel: string
  store: { name: string }
  today: { sales: number; orders: number }
  month: { sales: number; orders: number; average: number }
  pending: { count: number; orders: { id: string; number: string; total: number; name: string; created_at: string }[] }
  lowStock: { threshold: number; count: number; items: { id: string; product_id: string; product: string; variant: string; available: number }[] }
  topProducts: { id: string; title: string; quantity: number; revenue: number }[]
  byGovernorate: { name: string; orders: number; total: number }[]
  bySource: { name: string; orders: number; total: number }[]
}

/** الصفحة الرئيسية للوحة نقلة: مؤشرات المتجر */
const NaqlaDashboard = () => {
  const { t, token } = useNaqlaT()
  const count = useCount()
  const { data: d, error } = useNaqla<Dash>("/admin/naqla/dashboard")
  const cur = d?.currencyLabel ?? ""
  // الاسم: رمز «~…» يُترجم (مباشر، إعلانات Google…)، وغيره بيانات كما هي (utm_source، اسم منتج أو محافظة)
  const named = (v: string) => (v.startsWith("~") ? token(v) as string : <Data>{v}</Data>)
  return (
    <div className="flex flex-col gap-y-3" data-testid="naqla-dashboard">
      <PageHead title={t("dashboard.title")} sub={d ? <><Data>{d.store.name}</Data> — {t("dashboard.sub")}</> : t("common.loading")} />
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi testid="kpi-today" label={t("kpi.todaySales")} value={money(d.today.sales, cur)} hint={count(d.today.orders, "orders")} />
            <Kpi testid="kpi-month" label={t("kpi.monthSales")} value={money(d.month.sales, cur)} hint={`${count(d.month.orders, "orders")} · ${t("dashboard.avgCart", { value: money(d.month.average, cur) })}`} tone="navy" />
            <Kpi testid="kpi-pending" label={t("kpi.pending")} value={d.pending.count} hint={t("dashboard.pendingHint")} tone="gold" />
            <Kpi testid="kpi-low" label={t("kpi.lowStock")} value={d.lowStock.count} hint={t("dashboard.lowHint", { n: d.lowStock.threshold })} tone="green" />
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card title={t("kpi.pending")} testid="card-pending">
              {d.pending.orders.length ? (
                <div className="flex flex-col divide-y">
                  {d.pending.orders.map((o) => (
                    <a key={o.id} href={`/app/orders/${o.id}`} className="flex items-center justify-between py-2 hover:bg-ui-bg-subtle-hover">
                      <Text size="small" weight="plus"><span dir="ltr">{o.number}</span> · <Data>{o.name}</Data></Text>
                      <Text size="small" className="text-ui-fg-subtle">{money(o.total, cur)}</Text>
                    </a>
                  ))}
                </div>
              ) : <Text size="small" className="text-ui-fg-muted">{t("dashboard.noPending")}</Text>}
            </Card>
            <Card title={t("dashboard.lowStock")} testid="card-low">
              {d.lowStock.items.length ? (
                <div className="flex flex-col divide-y">
                  {d.lowStock.items.map((v) => (
                    <a key={v.id} href={`/app/products/${v.product_id}`} className="flex items-center justify-between py-2 hover:bg-ui-bg-subtle-hover">
                      <Text size="small" className="truncate"><b><Data>{v.product}</Data></b> — <Data>{v.variant}</Data></Text>
                      <Badge size="2xsmall" color={v.available <= 0 ? "red" : "orange"}>{v.available <= 0 ? t("dashboard.soldOut") : t("dashboard.left", { n: v.available })}</Badge>
                    </a>
                  ))}
                </div>
              ) : <Text size="small" className="text-ui-fg-muted">{t("dashboard.noLow")}</Text>}
            </Card>
            <Card title={t("dashboard.top")} testid="card-top">
              <BarList rows={d.topProducts.map((p) => ({ key: p.id, name: <Data>{p.title}</Data>, value: p.quantity, sub: money(p.revenue, cur) }))} label={(n) => count(n, "pieces")} />
            </Card>
            <Card title={t("dashboard.byGov")} testid="card-gov">
              <BarList rows={d.byGovernorate.map((g) => ({ key: g.name, name: named(g.name), value: g.total, sub: count(g.orders, "orders") }))} label={(n) => money(n, cur)} />
            </Card>
            <Card title={t("dashboard.bySource")} testid="card-source">
              <BarList rows={d.bySource.map((g) => ({ key: g.name, name: named(g.name), value: g.total, sub: count(g.orders, "orders") }))} label={(n) => money(n, cur)} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "naqla.nav.dashboard", translationNs: "translation", icon: ChartPie, rank: 1 })
export default NaqlaDashboard
