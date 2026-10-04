import Image from "next/image"
import { deliveryEta, governorateName, orderNumber } from "@lib/util/eta"
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

type Props = {
  order: HttpTypes.StoreOrder
  extras: Record<string, any>
  via?: string
}

const { checkout, currencyLabel: CUR } = storeConfig
const fmt = (n: number) => `${formatAmount(n)} ${CUR}`
const CONFETTI = ["var(--accent)", "var(--copper)", "#e8d5b5", "#9fd4c0"]

/** صفحة النجاح — مطابقة لصفحة التأكيد في الديمو */
export default function OrderCompletedTemplate({ order, extras, via }: Props) {
  const number = orderNumber(order.display_id)
  const addr = order.shipping_address
  const shipCode: string | undefined = extras.shipping_code
  const pickup = shipCode === "pickup"
  const providerId = order.payment_collections?.[0]?.payment_sessions?.[0]?.provider_id
  const pay = checkout.payments.find((p) => p.id === providerId || p.key === extras.payment_channel)
  const isWa = pay?.key === "whatsapp" || via === "whatsapp"
  const items = order.items ?? []
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const shipDiscount = (order as any).shipping_discount_total ?? 0
  const itemDiscount = Math.max(0, (order.discount_total ?? 0) - shipDiscount)
  const ship = order.shipping_methods?.[0]
  const placedAt = new Intl.DateTimeFormat("ar-OM", {
    timeZone: storeConfig.product.delivery.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(order.created_at ?? Date.now()))
  const eta = deliveryEta(shipCode, addr?.province)
  const phone = addr?.phone?.replace(checkout.phone.prefix, "")
  const name = [addr?.first_name, addr?.last_name].filter(Boolean).join(" ")

  const waLink = waUrl(
    orderMessage({
      number,
      items: items.map((i) => ({ title: i.product_title ?? i.title, variant: i.variant_title, qty: i.quantity, length: (i.metadata as any)?.length_cm })),
      total: order.total,
      shipping: ship?.name,
      place: pickup ? null : `${governorateName(addr?.province)} — ${addr?.city ?? ""}`,
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
          <h1>تم استلام طلبك!</h1>
          <p>شكراً لتسوقك من {storeConfig.shortName} — سنتواصل معك على واتساب لتأكيد الطلب</p>
          {phone && (
            <div className="phonechip">
              <Icon name="whatsapp" size={15} />
              <bdi dir="ltr">{checkout.phone.prefix} {phone.replace(/^(\d{4})(\d{4})$/, "$1 $2")}</bdi>
            </div>
          )}
          <div className="ordrow">
            <div className="ordernum" data-testid="order-number">رقم الطلب: <bdi dir="ltr">{number}</bdi></div>
            <CopyButton text={number} />
          </div>
          {isWa && (
            <a className="btn wa lg" href={waLink} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }} data-testid="wa-send">
              <Icon name="whatsapp" size={18} /> إرسال الطلب على واتساب
            </a>
          )}
        </div>

        {storeConfig.features.loyalty && extras._points?.points > 0 && (
          <div className="earned" data-testid="success-points">
            <Icon name="sparkle" size={22} />
            {extras._points.has_account ? (
              <div>
                <Signed className="big" sign="+" value={extras._points.points} />
                <small>
                  {extras._points.status === "available"
                    ? "نقطة ولاء أُضيفت لرصيدك المتاح"
                    : "نقطة ولاء معلّقة حتى التوصيل — تُتاح للاستبدال عند استلام طلبك"}
                </small>
              </div>
            ) : (
              <div>
                <Signed className="big" sign="+" value={extras._points.points} />
                <small>
                  نقطة ولاء {g("بانتظارك", "بانتظارك", "في انتظارك")} —{" "}
                  <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>{g("ادخلي برقمك", "ادخل برقمك")}</LocalizedClientLink>
                  {" "}لتُضاف لحسابك مع هذا الطلب
                </small>
              </div>
            )}
          </div>
        )}

        <div className="succgrid">
          <div className="panelbox">
            <h3>ماذا يحدث الآن؟</h3>
            <ul className="tl">
              <li className="done">
                <i><Icon name="check" size={13} /></i>
                <div><b>تم استلام الطلب</b><span>{isWa ? "بانتظار رسالتك على واتساب لتأكيده" : "وصلنا طلبك وبدأنا بمراجعته"}</span></div>
                <small>{placedAt}</small>
              </li>
              <li className="now">
                <i><Icon name="scissors" size={13} /></i>
                <div><b>قيد التجهيز في المشغل</b><span>كيّ وتغليف{extras.gift ? " هدية" : ""} وفحص نهائي للقطعة</span></div>
                <small>خلال ساعات</small>
              </li>
              <li>
                <i><Icon name="truck" size={13} /></i>
                <div>
                  <b>{pickup ? "جاهز للاستلام" : "في الطريق إليك"}</b>
                  <span>{pickup ? "نرسل لك رسالة عند الجاهزية" : "نرسل اسم المندوب ورقمه عند الانطلاق"}</span>
                </div>
              </li>
              <li>
                <i><Icon name="home" size={13} /></i>
                <div><b>{eta}</b><span>{pickup ? storeConfig.contact.address : "سيتصل المندوب قبل الوصول"}</span></div>
              </li>
            </ul>
          </div>

          <div className="panelbox">
            <h3>تفاصيل الطلب</h3>
            {items.map((i) => {
              const len = (i.metadata as any)?.length_cm
              return (
                <div key={i.id} className="oline">
                  <div className="mini">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="46px" />}</div>
                  <div>
                    {i.product_title}
                    <div className="q">{i.variant_title?.replace(" / ", " · ")} × {i.quantity}{len ? ` · طول ${len} سم` : ""}</div>
                    {tailoringNote(i.metadata) && <div className="q tnote">{tailoringNote(i.metadata)}</div>}
                  </div>
                  <span className="pr">{formatAmount(i.unit_price * i.quantity)}</span>
                </div>
              )
            })}
            <div style={{ marginTop: 10 }}>
              <div className="kv"><span>المجموع</span><span className="num">{fmt(subtotal)}</span></div>
              {itemDiscount > 0 && (
                <div className="kv"><span>الخصم</span><span style={{ color: "var(--accent)" }}><Signed sign="−" value={formatAmount(itemDiscount)} /> {CUR}</span></div>
              )}
              <div className="kv"><span>التوصيل</span><span>{ship?.name} · {order.shipping_total ? fmt(order.shipping_total) : shipDiscount > 0 ? "مجاني — امتياز العضوية" : "مجاني"}</span></div>
              <div className="kv"><span>الدفع</span><span>{pay?.title ?? "—"}</span></div>
              <div className="kv"><span>العنوان</span><span>{pickup ? "استلام من المشغل" : `${governorateName(addr?.province)} — ${addr?.city ?? ""}`}</span></div>
              {extras.gift && (
                <div className="kv"><span>هدية</span><span>{extras.gift_message ? `«${extras.gift_message}»` : "تغليف هدية"}</span></div>
              )}
              <div className="kv"><span><b style={{ color: "var(--ink)" }}>الإجمالي</b></span><span><b className="num">{fmt(order.total)}</b></span></div>
            </div>
          </div>
        </div>

        <div className="succacts">
          <LocalizedClientLink href="/store" className="btn">متابعة التسوق</LocalizedClientLink>
          <a className="btn ghost" href={`https://wa.me/${storeConfig.contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={16} /> {g("تواصلي معنا", "تواصل معنا")}
          </a>
        </div>
      </div>
    </div>
  )
}
