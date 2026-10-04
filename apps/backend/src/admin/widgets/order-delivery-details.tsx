import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { GOVERNORATES, PAYMENT, SHIPPING } from "../lib/oman"

/**
 * بطاقة «تفاصيل التوصيل» في صفحة الطلب: المحافظة بالاسم، الهدية ورسالة البطاقة،
 * ملاحظة المندوب، ونوع التوصيل وقناة الدفع — بدل البحث عنها في metadata.
 */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-x-4 px-6 py-3">
    <Text size="small" leading="compact" weight="plus" className="text-ui-fg-subtle shrink-0">
      {label}
    </Text>
    <div className="text-end">{children}</div>
  </div>
)

const OrderDeliveryDetailsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const meta = (order.metadata ?? {}) as Record<string, any>
  const addr = order.shipping_address
  const code = (addr?.province ?? "").toLowerCase()
  const gov = GOVERNORATES[code]
  const phone = (addr?.phone ?? "").replace(/\D/g, "")
  const pickup = meta.shipping_code === "pickup"

  return (
    <Container className="divide-y p-0" dir="rtl" data-testid="order-delivery-details">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">تفاصيل التوصيل</Heading>
        {meta.gift && <Badge color="orange" size="2xsmall">هدية</Badge>}
      </div>

      <Row label="المحافظة">
        <Text size="small" leading="compact">
          {gov ?? (addr?.province || "—")}
          {gov && <span className="text-ui-fg-muted"> ({code})</span>}
        </Text>
      </Row>
      <Row label="الولاية">
        <Text size="small" leading="compact">{addr?.city || "—"}</Text>
      </Row>
      {!pickup && addr?.address_1 && addr.address_1 !== addr.city && (
        <Row label="العنوان">
          <Text size="small" leading="compact">{addr.address_1}</Text>
        </Row>
      )}
      {meta.shipping_code && (
        <Row label="التوصيل">
          <Text size="small" leading="compact">{SHIPPING[meta.shipping_code] ?? meta.shipping_code}</Text>
        </Row>
      )}
      {meta.payment_channel && (
        <Row label="الدفع">
          <Text size="small" leading="compact">{PAYMENT[meta.payment_channel] ?? meta.payment_channel}</Text>
        </Row>
      )}
      <Row label="ملاحظة المندوب">
        <Text size="small" leading="compact" className={meta.courier_note ? "" : "text-ui-fg-muted"}>
          {meta.courier_note || "لا توجد"}
        </Text>
      </Row>
      {meta.gift && (
        <div className="bg-ui-bg-subtle px-6 py-4">
          <Text size="small" weight="plus" className="mb-1">
            🎁 طلب هدية — تغليف فاخر وبطاقة، بلا فاتورة داخل الطرد
          </Text>
          {meta.gift_message ? (
            <Text size="small" className="text-ui-fg-subtle">«{meta.gift_message}»</Text>
          ) : (
            <Text size="small" className="text-ui-fg-muted">بدون رسالة</Text>
          )}
        </div>
      )}
      {phone && (
        <div className="px-6 py-3">
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ui-fg-interactive txt-compact-small-plus hover:underline"
          >
            مراسلة الزبونة على واتساب ↗ <span dir="ltr">+{phone}</span>
          </a>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderDeliveryDetailsWidget
