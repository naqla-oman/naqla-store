import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * M32: بطاقة الزبونة المسجّلة بالهاتف — الاسم والهاتف والنقاط بدل بريد ‎@phone.invalid الداخلي.
 */
const fmtPhone = (p?: string | null) => {
  const d = String(p ?? "").replace(/\D/g, "")
  return d.length === 11 && d.startsWith("968") ? `+968 ${d.slice(3, 7)} ${d.slice(7)}` : p ?? ""
}

const CustomerPhoneCard = ({ data }: DetailWidgetProps<AdminCustomer>) => {
  const [pts, setPts] = useState<{ enabled: boolean; available?: number; pending?: number; tier?: string | null } | null>(null)
  useEffect(() => {
    fetch(`/admin/naqla/customers/${data.id}/loyalty`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setPts)
      .catch(() => setPts(null))
  }, [data.id])
  const byPhone = String(data.email ?? "").endsWith("@phone.invalid")
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "—"
  return (
    <Container className="divide-y p-0" data-testid="customer-phone-card">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">بيانات الزبونة</Heading>
        {byPhone && <Badge size="2xsmall" color="green">مسجّلة برقم الهاتف</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-y-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">الاسم</Text>
        <Text size="small" weight="plus">{name}</Text>
        <Text size="small" className="text-ui-fg-subtle">الهاتف</Text>
        <Text size="small" weight="plus" dir="ltr" className="text-end">{fmtPhone(data.phone) || "—"}</Text>
        {!byPhone && (
          <>
            <Text size="small" className="text-ui-fg-subtle">البريد</Text>
            <Text size="small">{data.email}</Text>
          </>
        )}
        {pts?.enabled && (
          <>
            <Text size="small" className="text-ui-fg-subtle">النقاط المتاحة</Text>
            <Text size="small" weight="plus" data-testid="customer-points">{pts.available ?? 0}{pts.pending ? ` (+${pts.pending} معلّقة)` : ""}</Text>
            <Text size="small" className="text-ui-fg-subtle">المستوى</Text>
            <Text size="small">{pts.tier ?? "—"}</Text>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "customer.details.before" })
export default CustomerPhoneCard
