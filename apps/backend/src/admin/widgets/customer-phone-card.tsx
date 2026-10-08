import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Data, naqlaApi, useNaqlaT } from "../lib/naqla-i18n"

/**
 * M32: بطاقة الزبونة المسجّلة بالهاتف — الاسم والهاتف والنقاط بدل بريد ‎@phone.invalid الداخلي.
 */
const fmtPhone = (p?: string | null) => {
  const d = String(p ?? "").replace(/\D/g, "")
  return d.length === 11 && d.startsWith("968") ? `+968 ${d.slice(3, 7)} ${d.slice(7)}` : p ?? ""
}

const CustomerPhoneCard = ({ data }: DetailWidgetProps<AdminCustomer>) => {
  const { t, lang } = useNaqlaT()
  const [pts, setPts] = useState<{ enabled: boolean; available?: number; pending?: number; tier?: string | null } | null>(null)
  useEffect(() => {
    naqlaApi(`/admin/naqla/customers/${data.id}/loyalty`, lang).then(setPts).catch(() => setPts(null))
  }, [data.id, lang])
  const byPhone = String(data.email ?? "").endsWith("@phone.invalid")
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ")
  return (
    <Container className="divide-y p-0" data-testid="customer-phone-card">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("customer.title")}</Heading>
        {byPhone && <Badge size="2xsmall" color="green">{t("customer.byPhone")}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-y-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">{t("customer.name")}</Text>
        <Text size="small" weight="plus">{name ? <Data>{name}</Data> : "—"}</Text>
        <Text size="small" className="text-ui-fg-subtle">{t("customer.phone")}</Text>
        <Text size="small" weight="plus" dir="ltr" className="text-end">{fmtPhone(data.phone) || "—"}</Text>
        {!byPhone && (
          <>
            <Text size="small" className="text-ui-fg-subtle">{t("customer.email")}</Text>
            <Text size="small">{data.email}</Text>
          </>
        )}
        {pts?.enabled && (
          <>
            <Text size="small" className="text-ui-fg-subtle">{t("customer.points")}</Text>
            <Text size="small" weight="plus" data-testid="customer-points">{pts.available ?? 0}{pts.pending ? ` ${t("customer.pending", { n: pts.pending })}` : ""}</Text>
            <Text size="small" className="text-ui-fg-subtle">{t("customer.tier")}</Text>
            <Text size="small">{pts.tier ? <Data>{pts.tier}</Data> : "—"}</Text>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "customer.details.before" })
export default CustomerPhoneCard
