import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Text } from "@medusajs/ui"
import { money, useNaqla } from "../components/naqla-ui"

type D = { currencyLabel: string; today: { sales: number; orders: number }; month: { sales: number }; pending: { count: number }; lowStock: { count: number } }

/** شريط مؤشرات أعلى صفحة الطلبات (وجهة اللوحة بعد الدخول) مع رابط لوحة المؤشرات الكاملة */
const OrdersKpiStrip = () => {
  const { data: d } = useNaqla<D>("/admin/naqla/dashboard")
  if (!d) return null
  const items = [
    ["مبيعات اليوم", money(d.today.sales, d.currencyLabel)],
    ["مبيعات الشهر", money(d.month.sales, d.currencyLabel)],
    ["بانتظار التجهيز", String(d.pending.count)],
    ["مخزون منخفض", String(d.lowStock.count)],
  ]
  return (
    <Container className="flex flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3" dir="rtl" data-testid="orders-kpi-strip">
      {items.map(([k, v]) => (
        <div key={k}><Text size="xsmall" className="text-ui-fg-subtle">{k}</Text><Text weight="plus">{v}</Text></div>
      ))}
      <a href="/app/naqla" className="ms-auto text-ui-fg-interactive txt-compact-small-plus hover:underline">لوحة المؤشرات ←</a>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.list.before" })
export default OrdersKpiStrip
