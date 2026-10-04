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


type Visit = Record<string, string | number | undefined> | null | undefined

/** وصف الزيارة: utm أولاً، وإلا المنصة من معرّف النقرة، وإلا المرجع، وإلا «مباشر» */
const CLICK: [string, string][] = [["gclid", "إعلانات Google"], ["fbclid", "Meta (فيسبوك/إنستغرام)"], ["ScCid", "سناب شات"], ["ttclid", "تيك توك"]]
function describeVisit(v: Visit) {
  if (!v) return null
  const click = CLICK.find(([k]) => v[k])
  const src = v.utm_source ? `${v.utm_source}${v.utm_medium ? ` / ${v.utm_medium}` : ""}` : click ? click[1] : v.ref ? String(v.ref) : "مباشر"
  return {
    src,
    campaign: v.utm_campaign ? String(v.utm_campaign) : null,
    click: click ? click[1] : null,
    landing: v.landing ? String(v.landing) : null,
    date: v.ts ? new Date(Number(v.ts)).toLocaleDateString("ar-OM", { day: "numeric", month: "short" }) : null,
  }
}

/** نفس الزيارة إن تطابقت حقول المصدر (الوقت قد يختلف بأجزاء ثانية عند أول تحويل) */
const SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "ScCid", "ttclid", "landing"]
const sameVisit = (a: Visit, b: Visit) => !!a && !!b && SOURCE_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null))

const VisitRow = ({ label, v }: { label: string; v: ReturnType<typeof describeVisit> }) =>
  v ? (
    <Row label={label}>
      <Text size="small" leading="compact" weight="plus">{v.src}</Text>
      {v.campaign && <Text size="xsmall" className="text-ui-fg-subtle">الحملة: <span dir="ltr">{v.campaign}</span></Text>}
      {v.click && v.src !== v.click && <Text size="xsmall" className="text-ui-fg-subtle">نقرة إعلان: {v.click}</Text>}
      {(v.landing || v.date) && <Text size="xsmall" className="text-ui-fg-muted"><span dir="ltr">{v.landing}</span>{v.date ? ` · ${v.date}` : ""}</Text>}
    </Row>
  ) : null

const OrderDeliveryDetailsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const meta = (order.metadata ?? {}) as Record<string, any>
  const addr = order.shipping_address
  const code = (addr?.province ?? "").toLowerCase()
  const gov = GOVERNORATES[code]
  const phone = (addr?.phone ?? "").replace(/\D/g, "")
  const pickup = meta.shipping_code === "pickup"
  // خدمات التفصيل الخاص في الطلب (line item metadata.tailoring)
  const tailored = (order.items ?? []).filter((i: any) => i.metadata?.tailoring)
  const MEASURE: Record<string, string> = { length: "الطول", chest: "الصدر", shoulder: "الكتف", sleeve: "الكم" }

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
      {tailored.map((i: any) => {
        const t = i.metadata.tailoring
        return (
          <div key={i.id} className="px-6 py-4" data-testid="tailoring-details">
            <Text size="small" weight="plus" className="mb-1">✂️ {i.variant_title || i.title}{t.for ? ` — لـ ${t.for}` : ""}</Text>
            {t.contact ? (
              <Text size="small" className="text-ui-fg-subtle">تواصلوا مع الزبونة لأخذ المقاسات</Text>
            ) : (
              <div className="grid grid-cols-4 gap-2 mt-1">
                {Object.entries(t.measurements ?? {}).map(([k, v]) => (
                  <div key={k} className="bg-ui-bg-subtle rounded-md px-2 py-1 text-center">
                    <Text size="xsmall" className="text-ui-fg-muted">{MEASURE[k] ?? k}</Text>
                    <Text size="small" weight="plus">{String(v)} سم</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {meta.attribution && (
        <div data-testid="order-source">
          <div className="px-6 pt-4">
            <Text size="small" weight="plus">مصدر الطلب</Text>
          </div>
          <VisitRow label="آخر زيارة" v={describeVisit(meta.attribution.last)} />
          {sameVisit(meta.attribution.first, meta.attribution.last) ? null : (
            <VisitRow label="أول زيارة" v={describeVisit(meta.attribution.first)} />
          )}
          {!meta.attribution.first && !meta.attribution.last && (
            <Row label="الزيارة"><Text size="small" leading="compact">مباشر (بلا حملة)</Text></Row>
          )}
          <Row label="موافقة التتبع">
            <Text size="small" leading="compact">
              {meta.attribution.consent?.ads ? "إعلانات ✓" : "إعلانات ✗"} · {meta.attribution.consent?.analytics ? "تحليلات ✓" : "تحليلات ✗"}
            </Text>
          </Row>
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
