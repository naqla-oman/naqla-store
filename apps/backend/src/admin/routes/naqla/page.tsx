import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartPie } from "@medusajs/icons"
import { Badge, Text } from "@medusajs/ui"
import { BarList, Card, count, Kpi, money, N, PageHead, useNaqla } from "../../components/naqla-ui"

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
  const { data: d, error } = useNaqla<Dash>("/admin/naqla/dashboard")
  const cur = d?.currencyLabel ?? ""
  return (
    <div className="flex flex-col gap-y-3" dir="rtl" data-testid="naqla-dashboard">
      <PageHead title="لوحة المؤشرات" sub={d ? `${d.store.name} — المبيعات بتوقيت مسقط، والملغاة غير محتسبة` : "جارٍ التحميل…"} />
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi testid="kpi-today" label="مبيعات اليوم" value={money(d.today.sales, cur)} hint={count(d.today.orders, N.orders)} />
            <Kpi testid="kpi-month" label="مبيعات الشهر" value={money(d.month.sales, cur)} hint={`${count(d.month.orders, N.orders)} · متوسط السلة ${money(d.month.average, cur)}`} tone="navy" />
            <Kpi testid="kpi-pending" label="بانتظار التجهيز" value={d.pending.count} hint="طلبات بلا تنفيذ بعد" tone="gold" />
            <Kpi testid="kpi-low" label="مخزون منخفض" value={d.lowStock.count} hint={`متغيّرات متاحها ${d.lowStock.threshold} أو أقل`} tone="green" />
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card title="بانتظار التجهيز" testid="card-pending">
              {d.pending.orders.length ? (
                <div className="flex flex-col divide-y">
                  {d.pending.orders.map((o) => (
                    <a key={o.id} href={`/app/orders/${o.id}`} className="flex items-center justify-between py-2 hover:bg-ui-bg-subtle-hover">
                      <Text size="small" weight="plus"><span dir="ltr">{o.number}</span> · {o.name}</Text>
                      <Text size="small" className="text-ui-fg-subtle">{money(o.total, cur)}</Text>
                    </a>
                  ))}
                </div>
              ) : <Text size="small" className="text-ui-fg-muted">لا طلبات بانتظار التجهيز</Text>}
            </Card>
            <Card title="المخزون المنخفض" testid="card-low">
              {d.lowStock.items.length ? (
                <div className="flex flex-col divide-y">
                  {d.lowStock.items.map((v) => (
                    <a key={v.id} href={`/app/products/${v.product_id}`} className="flex items-center justify-between py-2 hover:bg-ui-bg-subtle-hover">
                      <Text size="small" className="truncate"><b>{v.product}</b> — {v.variant}</Text>
                      <Badge size="2xsmall" color={v.available <= 0 ? "red" : "orange"}>{v.available <= 0 ? "نفد" : `بقي ${v.available}`}</Badge>
                    </a>
                  ))}
                </div>
              ) : <Text size="small" className="text-ui-fg-muted">لا متغيّرات تحت الحد</Text>}
            </Card>
            <Card title="أفضل المنتجات (30 يوماً)" testid="card-top">
              <BarList rows={d.topProducts.map((p) => ({ name: p.title, value: p.quantity, sub: money(p.revenue, cur) }))} label={(n) => count(n, N.pieces)} />
            </Card>
            <Card title="المبيعات حسب المحافظة (30 يوماً)" testid="card-gov">
              <BarList rows={d.byGovernorate.map((g) => ({ name: g.name, value: g.total, sub: count(g.orders, N.orders) }))} label={(n) => money(n, cur)} />
            </Card>
            <Card title="المبيعات حسب مصدر الطلب (30 يوماً)" testid="card-source">
              <BarList rows={d.bySource.map((g) => ({ name: g.name, value: g.total, sub: count(g.orders, N.orders) }))} label={(n) => money(n, cur)} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "لوحة المؤشرات", icon: ChartPie, rank: 1 })
export default NaqlaDashboard
