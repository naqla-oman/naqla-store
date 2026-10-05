"use client"

import Image from "next/image"
import { TrackedOrder, trackOrder } from "@lib/data/account"
import { deliveryEta, governorateName, orderNumber } from "@lib/util/eta"
import { formatAmount } from "@lib/util/money"
import Icon from "@modules/common/components/icon"
import { FormEvent, useEffect, useRef, useState } from "react"
import { storeConfig } from "../../store.config"
import { g } from "@lib/voice"

const { checkout, currencyLabel: CUR } = storeConfig
const t = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("ar-OM", { timeZone: storeConfig.product.delivery.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : ""

/** تتبّع الطلب بلا تسجيل دخول: رقم الطلب + الهاتف */
export default function TrackOrder({ initialNo, initialPhone, signedIn = false }: { initialNo: string; initialPhone: string; signedIn?: boolean }) {
  const [no, setNo] = useState(initialNo)
  const [phone, setPhone] = useState(initialPhone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const auto = useRef(false)

  const search = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true); setError(null)
    const r = await trackOrder(no, phone)
    setBusy(false)
    if (!r.ok) { setOrder(null); setError(r.error); return }
    setOrder(r.data!)
  }

  useEffect(() => {
    if (!auto.current && initialNo && (initialPhone || signedIn)) { auto.current = true; search() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickup = order?.shipping_code === "pickup"
  const STEPS = [
    { t: "تم استلام الطلب", d: "وصلنا طلبك وبدأنا بمراجعته", i: "check", at: order?.times.placed },
    { t: "قيد التجهيز في المشغل", d: "كيّ وتغليف وفحص نهائي للقطعة", i: "scissors", at: order?.times.packed },
    { t: pickup ? "جاهز للاستلام" : "في الطريق إليك", d: pickup ? storeConfig.contact.address : "المندوب انطلق — سيتصل قبل الوصول", i: "truck", at: order?.times.shipped },
    { t: pickup ? "تم الاستلام" : "تم التوصيل", d: g("نتمنى أن تسعدك القطعة", "نتمنى أن تسعدك القطعة", "نتمنى أن ينال طلبك رضاك"), i: "home", at: order?.times.delivered },
  ]
  const stage = order?.stage ?? 0
  const current = stage >= 0 ? STEPS[Math.min(stage, 3)] : null
  const number = order ? orderNumber(order.display_id) : ""
  const help = `مرحباً ${storeConfig.shortName}، أحتاج مساعدة في طلبي ${number}`

  return (
    <div className="wrap">
      <div className="trackpage">
        <div className="secthead"><div><h1>تتبّع طلبك</h1><p>بلا تسجيل دخول — {g("أدخلي رقم الطلب ورقم هاتفك", "أدخل رقم الطلب ورقم هاتفك")}</p></div></div>
        <form className="panelbox" onSubmit={search} noValidate>
          <div className="f2">
            <div className="field">
              <label htmlFor="tNo">رقم الطلب</label>
              <input id="tNo" value={no} onChange={(e) => setNo(e.target.value)} placeholder={`${checkout.orderPrefix}0001`} dir="ltr" style={{ textAlign: "start" }} autoComplete="off" />
            </div>
            {!signedIn && (
            <div className="field">
              <label htmlFor="tPh">رقم الهاتف</label>
              <div className="phone">
                <input id="tPh" type="tel" inputMode="numeric" maxLength={8} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={checkout.phone.placeholder} dir="ltr" />
                <span className="pre">{checkout.phone.prefix}</span>
              </div>
            </div>
            )}
          </div>
          {error && <div className="alert" role="alert"><Icon name="x" size={15} /> {error}</div>}
          <button type="submit" className="btn block" style={{ marginTop: 16 }} disabled={busy} data-testid="track-btn">
            <Icon name="search" size={16} /> {busy ? "جارٍ البحث…" : "عرض حالة الطلب"}
          </button>
        </form>

        {order && (
          <div className="panelbox" style={{ marginTop: 16 }} data-testid="track-result">
            {stage < 0 ? (
              <div className="statusbar canceled"><div className="ic"><Icon name="x" /></div><div><b>الطلب ملغى</b><span>الطلب <bdi dir="ltr">{number}</bdi></span></div></div>
            ) : (
              <div className="statusbar">
                <div className="ic"><Icon name={current!.i} /></div>
                <div><b>{current!.t}</b><span>الطلب <bdi dir="ltr">{number}</bdi> · {order.shipping_name}</span></div>
              </div>
            )}
            {stage >= 0 && stage < 3 && (
              <div className="etasum" style={{ marginTop: 14 }}><Icon name="clock" size={15} /> التوصيل المتوقع: {deliveryEta(order.shipping_code, order.province, new Date(order.times.placed))}</div>
            )}
            {stage >= 0 && (
              <ul className="tl" style={{ marginTop: 16 }}>
                {STEPS.map((s, i) => (
                  <li key={s.t} className={i < stage || (i === 3 && stage === 3) || i === 0 ? "done" : i === stage ? "now" : ""}>
                    <i><Icon name={s.i} size={13} /></i>
                    <div><b>{s.t}</b><span>{s.d}</span></div>
                    <small>{i === 0 ? t(s.at) : i <= stage ? t(s.at) : ""}</small>
                  </li>
                ))}
              </ul>
            )}
            <h3 style={{ marginTop: 6 }}>القطع</h3>
            {order.items.map((i) => (
              <div key={i.id} className="oline">
                <div className="mini">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="46px" />}</div>
                <div>{i.title}<div className="q">{i.variant?.replace(" / ", " · ")} × {i.quantity}</div></div>
                <span className="pr">{formatAmount(i.unit_price * i.quantity)}</span>
              </div>
            ))}
            <div className="kv" style={{ marginTop: 6 }}><span>العنوان</span><span>{pickup ? "استلام من المشغل" : `${governorateName(order.province)} — ${order.city ?? ""}`}</span></div>
            <div className="kv"><span>الإجمالي</span><span className="num">{formatAmount(order.total)} {CUR}</span></div>
            <div className="helprow">
              <a href={`https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(help + " — أرغب بتغيير وقت التوصيل")}`} target="_blank" rel="noopener noreferrer"><Icon name="clock" size={14} /> تغيير وقت التوصيل</a>
              <a href={`https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(help)}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={14} /> مساعدة في الطلب</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
