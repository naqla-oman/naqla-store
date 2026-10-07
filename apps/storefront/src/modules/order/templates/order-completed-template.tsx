import Image from "next/image"
import { deliveryEta, orderNumber } from "@lib/util/eta"
import { formatAmount } from "@lib/util/money"
import { orderMessage, waUrl } from "@lib/util/wa-order"
import { HttpTypes } from "@medusajs/types"
import Signed from "@modules/common/components/signed"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CopyButton from "@modules/order/components/copy-button"
import { PurchaseEvent } from "@modules/common/components/track-events"
import { storeConfig } from "../../../store.config"
import { g } from "@lib/voice"
import { tailoringNote } from "@lib/util/tailoring"
import { includedTax } from "@lib/util/tax"
import { discountLines } from "@lib/util/discounts"
import { useLocale } from "next-intl"
import { useCurrencyLabel, useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"
import { placeLabel } from "@lib/util/labels"

type Props = {
  order: HttpTypes.StoreOrder
  extras: Record<string, any>
  via?: string
}

const { checkout } = storeConfig
const CONFETTI = ["var(--accent)", "var(--copper)", "#e8d5b5", "#9fd4c0"]

/** صفحة النجاح — مطابقة لصفحة التأكيد في الديمو */
export default function OrderCompletedTemplate({ order, extras, via }: Props) {
  const sc = useStoreConfig()
  const t = useT("order")
  const locale = useLocale()
  const CUR = useCurrencyLabel()
  const fmt = (n: number) => `${formatAmount(n)} ${CUR}`
  const number = orderNumber(order.display_id)
  const addr = order.shipping_address
  const shipCode: string | undefined = extras.shipping_code
  const pickup = shipCode === "pickup"
  const providerId = order.payment_collections?.[0]?.payment_sessions?.[0]?.provider_id
  const pay = sc.checkout.payments.find((p) => p.id === providerId || p.key === extras.payment_channel)
  const isWa = pay?.key === "whatsapp" || via === "whatsapp"
  const items = order.items ?? []
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const shipDiscount = (order as any).shipping_discount_total ?? 0
  const itemDiscount = Math.max(0, (order.discount_total ?? 0) - shipDiscount)
  const ship = order.shipping_methods?.[0]
  const placedAt = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
    timeZone: sc.product.delivery.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(order.created_at ?? Date.now()))
  const eta = deliveryEta(t, locale, shipCode, addr?.province)
  const phone = addr?.phone?.replace(checkout.phone.prefix, "")
  const name = [addr?.first_name, addr?.last_name].filter(Boolean).join(" ")

  const waLink = waUrl(
    orderMessage(t, CUR, {
      number,
      items: items.map((i) => ({ title: i.product_title ?? i.title, variant: i.variant_title, qty: i.quantity, length: (i.metadata as any)?.length_cm })),
      total: order.total,
      shipping: ship?.name,
      place: pickup ? null : `${placeLabel(sc, addr?.province, addr?.city)}`,
      name,
      gift: !!extras.gift,
      giftMessage: extras.gift_message,
    })
  )

  return (
    <div className="wrap">
      <div className="succwrap" data-testid="order-complete-container">
        <PurchaseEvent
          orderId={order.id}
          value={order.total}
          currency={order.currency_code}
          items={items.map((i) => ({ id: i.variant_id ?? i.id, name: i.product_title ?? i.title, price: i.unit_price, quantity: i.quantity, variant: i.variant_title ?? undefined }))}
        />
        <div className="succhero">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 26 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 3.9) % 100}%`, background: CONFETTI[i % 4], animationDelay: `${(i % 7) * 0.12}s` }} />
            ))}
          </div>
          <div className="ring"><Icon name="check" size={40} /></div>
          <h1>{t("s414e71")}</h1>
          <p>{t("thanksWa", { store: sc.shortName })}</p>
          {phone && (
            <div className="phonechip">
              <Icon name="whatsapp" size={15} />
              <bdi dir="ltr">{checkout.phone.prefix} {phone.replace(/^(\d{4})(\d{4})$/, "$1 $2")}</bdi>
            </div>
          )}
          <div className="ordrow">
            <div className="ordernum" data-testid="order-number">{t("sf65cd3")} <bdi dir="ltr">{number}</bdi></div>
            <CopyButton text={number} />
          </div>
          {isWa && (
            <a className="btn wa lg" href={waLink} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }} data-testid="wa-send">
              <Icon name="whatsapp" size={18} /> {t("sendOnWa")}
            </a>
          )}
        </div>

        {sc.features.loyalty && extras._points?.points > 0 && (
          <div className="earned" data-testid="success-points">
            <Icon name="sparkle" size={22} />
            {extras._points.has_account ? (
              <div>
                <Signed className="big" sign="+" value={extras._points.points} />
                <small>
                  {extras._points.status === "available"
                    ? t("sf985e1")
                    : t("sbf6d3d")}
                </small>
              </div>
            ) : (
              <div>
                <Signed className="big" sign="+" value={extras._points.points} />
                <small>
                  {t("s4517ad")} {t("s723688")} —{" "}
                  <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>{t("s33c19c")}</LocalizedClientLink>
                  {" "}{t("pointsToAccount")}
                </small>
              </div>
            )}
          </div>
        )}

        <div className="succgrid">
          <div className="panelbox">
            <h3>{t("sb7aaf8")}</h3>
            <ul className="tl">
              <li className="done">
                <i><Icon name="check" size={13} /></i>
                <div><b>{t("s5a2478")}</b><span>{isWa ? t("s697aa5") : t("sce6a73")}</span></div>
                <small>{placedAt}</small>
              </li>
              <li className="now">
                <i><Icon name="scissors" size={13} /></i>
                <div><b>{t("s4b3fe2")}</b><span>{t("prepNote", { gift: extras.gift ? t("s527426") : "" })}</span></div>
                <small>{t("s9cb7fa")}</small>
              </li>
              <li>
                <i><Icon name="truck" size={13} /></i>
                <div>
                  <b>{pickup ? t("sff4351") : t("se99455")}</b>
                  <span>{pickup ? t("s30a88f") : t("s2a5a85")}</span>
                </div>
              </li>
              <li>
                <i><Icon name="home" size={13} /></i>
                <div><b>{eta}</b><span>{pickup ? sc.contact.address : t("sbab52e")}</span></div>
              </li>
            </ul>
          </div>

          <div className="panelbox">
            <h3>{t("sc7f2ce")}</h3>
            {items.map((i) => {
              const len = (i.metadata as any)?.length_cm
              return (
                <div key={i.id} className="oline">
                  <div className="mini">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="46px" />}</div>
                  <div>
                    {i.product_title}
                    <div className="q">{i.variant_title?.replace(" / ", " · ")} × {i.quantity}{len ? ` · ${t("common.lengthCm", { len })}` : ""}</div>
                    {tailoringNote(i.metadata, t, sc) && <div className="q tnote">{tailoringNote(i.metadata, t, sc)}</div>}
                  </div>
                  <span className="pr">{formatAmount(i.unit_price * i.quantity)}</span>
                </div>
              )
            })}
            <div style={{ marginTop: 10 }}>
              <div className="kv"><span>{t("s7512af")}</span><span className="num">{fmt(subtotal)}</span></div>
              {/* منخفضة: سطر لكل عرض بمبلغه (الكود منفصل عن امتياز المستوى) */}
              {itemDiscount > 0 && discountLines(t, items, null).map((d) => (
                <div key={d.code} className="kv" data-testid="discount-line"><span>{d.label}</span><span style={{ color: "var(--accent)" }}><Signed sign="−" value={formatAmount(d.amount)} /> {CUR}</span></div>
              ))}
              <div className="kv"><span>{t("s30ecbc")}</span><span>{ship?.name} · {order.shipping_total ? fmt(order.shipping_total) : shipDiscount > 0 ? t("sdf761f") : t("s5abc46")}</span></div>
              <div className="kv"><span>{t("s4ee631")}</span><span>{pay?.title ?? "—"}</span></div>
              <div className="kv"><span>{t("s6dc658")}</span><span>{pickup ? t("sd4cab2") : `${placeLabel(sc, addr?.province, addr?.city)}`}</span></div>
              {extras.gift && (
                <div className="kv"><span>{t("s8a9ce8")}</span><span>{extras.gift_message ? `«${extras.gift_message}»` : t("sa25e32")}</span></div>
              )}
              <div className="kv"><span><b style={{ color: "var(--ink)" }}>{t("s88fc73")}</b></span><span><b className="num">{fmt(order.total)}</b></span></div>
            {(() => {
              const tax = includedTax(Number(order.total), (order as any).tax_total)
              return tax.rate > 0 ? <div className="kv taxnote" data-testid="tax-line"><span>{t("taxIncluded", { rate: tax.rate })}</span><span className="num">{fmt(tax.amount)}</span></div> : null
            })()}
            </div>
          </div>
        </div>

        <div className="succacts">
          <LocalizedClientLink href="/store" className="btn">{t("s279044")}</LocalizedClientLink>
          <a className="btn ghost" href={`https://wa.me/${sc.contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={16} /> {t("s34a9aa")}
          </a>
        </div>
      </div>
    </div>
  )
}
