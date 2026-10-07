import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Text } from "@medusajs/ui"
import { money, useNaqla } from "../components/naqla-ui"
import { useNaqlaT } from "../lib/naqla-i18n"

type D = { currencyLabel: string; today: { sales: number; orders: number }; month: { sales: number }; pending: { count: number }; lowStock: { count: number } }

/** شريط مؤشرات أعلى صفحة الطلبات (وجهة اللوحة بعد الدخول) مع رابط لوحة المؤشرات الكاملة */
const OrdersKpiStrip = () => {
  const { t } = useNaqlaT()
  const { data: d } = useNaqla<D>("/admin/naqla/dashboard")
  if (!d) return null
  const items = [
    [t("kpi.todaySales"), money(d.today.sales, d.currencyLabel)],
    [t("kpi.monthSales"), money(d.month.sales, d.currencyLabel)],
    [t("kpi.pending"), String(d.pending.count)],
    [t("kpi.lowStock"), String(d.lowStock.count)],
  ]
  return (
    <Container className="flex flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3" data-testid="orders-kpi-strip">
      {items.map(([k, v]) => (
        <div key={k}><Text size="xsmall" className="text-ui-fg-subtle">{k}</Text><Text weight="plus">{v}</Text></div>
      ))}
      <a href="/app/naqla" className="ms-auto text-ui-fg-interactive txt-compact-small-plus hover:underline">{t("kpi.dashboardLink")}</a>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.list.before" })
export default OrdersKpiStrip
