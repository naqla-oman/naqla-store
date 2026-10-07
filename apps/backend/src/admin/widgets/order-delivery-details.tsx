import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useStoreLabels } from "../lib/labels"
import { Data, useNaqlaT } from "../lib/naqla-i18n"

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

/** وصف الزيارة: utm أولاً، وإلا المنصة من معرّف النقرة، وإلا المرجع، وإلا «مباشر» — المنصات من naqla.delivery.clicks */
const CLICK = ["gclid", "fbclid", "ScCid", "ttclid"]
type Described = { src: string; srcIsData: boolean; campaign: string | null; click: string | null; landing: string | null; date: string | null }
function describeVisit(v: Visit, t: (k: string) => string, lang: "ar" | "en"): Described | null {
  if (!v) return null
  const click = CLICK.find((k) => v[k])
  const clickName = click ? t(`delivery.clicks.${click}`) : null
  const data = v.utm_source ? `${v.utm_source}${v.utm_medium ? ` / ${v.utm_medium}` : ""}` : !click && v.ref ? String(v.ref) : null
  return {
    src: data ?? clickName ?? t("tokens.direct"),
    srcIsData: data !== null,
    campaign: v.utm_campaign ? String(v.utm_campaign) : null,
    click: clickName,
    landing: v.landing ? String(v.landing) : null,
    date: v.ts ? new Date(Number(v.ts)).toLocaleDateString(lang === "ar" ? "ar-OM" : "en-GB", { day: "numeric", month: "short" }) : null,
  }
}

/** نفس الزيارة إن تطابقت حقول المصدر (الوقت قد يختلف بأجزاء ثانية عند أول تحويل) */
const SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "ScCid", "ttclid", "landing"]
const sameVisit = (a: Visit, b: Visit) => !!a && !!b && SOURCE_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null))

const VisitRow = ({ label, v }: { label: string; v: Described | null }) => {
  const { t } = useNaqlaT()
  return v ? (
    <Row label={label}>
      <Text size="small" leading="compact" weight="plus">{v.srcIsData ? <Data dir="ltr">{v.src}</Data> : v.src}</Text>
      {v.campaign && <Text size="xsmall" className="text-ui-fg-subtle">{t("delivery.campaign")} <Data dir="ltr">{v.campaign}</Data></Text>}
      {v.click && v.src !== v.click && <Text size="xsmall" className="text-ui-fg-subtle">{t("delivery.adClick")} {v.click}</Text>}
      {(v.landing || v.date) && <Text size="xsmall" className="text-ui-fg-muted"><span dir="ltr">{v.landing}</span>{v.date ? ` · ${v.date}` : ""}</Text>}
    </Row>
  ) : null
}

const OrderDeliveryDetailsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { t, lang } = useNaqlaT()
  // منخفضة: أسماء المحافظات والتوصيل من إعداد العميل (لا خرائط عُمانية ثابتة)
  const { governorates: GOVERNORATES, shipping: SHIPPING, payment: PAYMENT, wilayats: WILAYATS } = useStoreLabels()
  const meta = (order.metadata ?? {}) as Record<string, any>
  const addr = order.shipping_address
  const code = (addr?.province ?? "").toLowerCase()
  const gov = GOVERNORATES[code]
  const phone = (addr?.phone ?? "").replace(/\D/g, "")
  const pickup = meta.shipping_code === "pickup"
  // خدمات التفصيل الخاص في الطلب (line item metadata.tailoring)
  const tailored = (order.items ?? []).filter((i: any) => i.metadata?.tailoring)

  return (
    <Container className="divide-y p-0" data-testid="order-delivery-details">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("delivery.title")}</Heading>
        {meta.gift && <Badge color="orange" size="2xsmall">{t("delivery.gift")}</Badge>}
      </div>

      <Row label={t("delivery.governorate")}>
        <Text size="small" leading="compact">
          {gov ? <Data>{gov}</Data> : (addr?.province || "—")}
          {gov && <span className="text-ui-fg-muted"> ({code})</span>}
        </Text>
      </Row>
      <Row label={t("delivery.wilayat")}>
        <Text size="small" leading="compact">{addr?.city ? <Data>{WILAYATS[addr.city] ?? addr.city}</Data> : "—"}</Text>
      </Row>
      {!pickup && addr?.address_1 && addr.address_1 !== addr.city && (
        <Row label={t("delivery.address")}>
          <Text size="small" leading="compact"><Data>{addr.address_1}</Data></Text>
        </Row>
      )}
      {meta.shipping_code && (
        <Row label={t("delivery.shipping")}>
          <Text size="small" leading="compact"><Data>{SHIPPING[meta.shipping_code] ?? meta.shipping_code}</Data></Text>
        </Row>
      )}
      {meta.payment_channel && (
        <Row label={t("delivery.payment")}>
          <Text size="small" leading="compact">{PAYMENT[meta.payment_channel] ?? <Data>{meta.payment_channel}</Data>}</Text>
        </Row>
      )}
      <Row label={t("delivery.courierNote")}>
        <Text size="small" leading="compact" className={meta.courier_note ? "" : "text-ui-fg-muted"}>
          {meta.courier_note ? <Data>{meta.courier_note}</Data> : t("delivery.none")}
        </Text>
      </Row>
      {meta.gift && (
        <div className="bg-ui-bg-subtle px-6 py-4">
          <Text size="small" weight="plus" className="mb-1">
            🎁 {t("delivery.giftNote")}
          </Text>
          {meta.gift_message ? (
            <Text size="small" className="text-ui-fg-subtle">«<Data>{meta.gift_message}</Data>»</Text>
          ) : (
            <Text size="small" className="text-ui-fg-muted">{t("delivery.noMessage")}</Text>
          )}
        </div>
      )}
      {tailored.map((i: any) => {
        const tl = i.metadata.tailoring
        return (
          <div key={i.id} className="px-6 py-4" data-testid="tailoring-details">
            <Text size="small" weight="plus" className="mb-1">✂️ <Data>{i.variant_title || i.title}</Data>{tl.for ? <> — {t("delivery.for")}<Data>{tl.for}</Data></> : ""}</Text>
            {tl.contact ? (
              <Text size="small" className="text-ui-fg-subtle">{t("delivery.contactForMeasures")}</Text>
            ) : (
              <div className="grid grid-cols-4 gap-2 mt-1">
                {Object.entries(tl.measurements ?? {}).map(([k, v]) => (
                  <div key={k} className="bg-ui-bg-subtle rounded-md px-2 py-1 text-center">
                    <Text size="xsmall" className="text-ui-fg-muted">{["length", "chest", "shoulder", "sleeve"].includes(k) ? t(`delivery.measures.${k}`) : k}</Text>
                    <Text size="small" weight="plus">{t("delivery.cm", { n: String(v) })}</Text>
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
            <Text size="small" weight="plus">{t("delivery.source")}</Text>
          </div>
          <VisitRow label={t("delivery.lastVisit")} v={describeVisit(meta.attribution.last, t, lang)} />
          {sameVisit(meta.attribution.first, meta.attribution.last) ? null : (
            <VisitRow label={t("delivery.firstVisit")} v={describeVisit(meta.attribution.first, t, lang)} />
          )}
          {!meta.attribution.first && !meta.attribution.last && (
            <Row label={t("delivery.visit")}><Text size="small" leading="compact">{t("delivery.directNoCampaign")}</Text></Row>
          )}
          <Row label={t("delivery.consent")}>
            <Text size="small" leading="compact">
              {t("delivery.ads")} {meta.attribution.consent?.ads ? "✓" : "✗"} · {t("delivery.analytics")} {meta.attribution.consent?.analytics ? "✓" : "✗"}
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
            {t("delivery.whatsapp")} <span dir="ltr">+{phone}</span>
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
