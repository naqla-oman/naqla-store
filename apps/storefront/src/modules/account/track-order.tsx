"use client"

import Image from "next/image"
import { TrackedOrder, trackOrder } from "@lib/data/account"
import { deliveryEta, governorateName, orderNumber } from "@lib/util/eta"
import { formatAmount } from "@lib/util/money"
import Icon from "@modules/common/components/icon"
import { FormEvent, useEffect, useRef, useState } from "react"
import { storeConfig } from "../../store.config"
import { g } from "@lib/voice"
import { useLocale } from "next-intl"
import { useCurrencyLabel, useT } from "@/i18n/t"

const { checkout } = storeConfig
const fmtTime = (locale: string, iso?: string | null) =>
  iso ? new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { timeZone: storeConfig.product.delivery.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : ""

/** تتبّع الطلب بلا تسجيل دخول: رقم الطلب + الهاتف */
export default function TrackOrder({ initialNo, initialPhone, signedIn = false }: { initialNo: string; initialPhone: string; signedIn?: boolean }) {
  const t = useT("tracking")
  const CUR = useCurrencyLabel()
  const locale = useLocale()
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
    { t: t("s5a2478"), d: t("sce6a73"), i: "check", at: order?.times.placed },
    { t: t("s4b3fe2"), d: t("sbfbcf6"), i: "scissors", at: order?.times.packed },
    { t: pickup ? t("sff4351") : t("se99455"), d: pickup ? storeConfig.contact.address : t("s6dbe06"), i: "truck", at: order?.times.shipped },
    { t: pickup ? t("s1fb4a1") : t("s3a0c4f"), d: t("s3c22a1"), i: "home", at: order?.times.delivered },
  ]
  const stage = order?.stage ?? 0
  const current = stage >= 0 ? STEPS[Math.min(stage, 3)] : null
  const number = order ? orderNumber(order.display_id) : ""
  const help = t("waHelp", { store: storeConfig.shortName, number })

  return (
    <div className="wrap">
      <div className="trackpage">
        <div className="secthead"><div><h1>{t("s9241c5")}</h1><p>{t("noLogin")} — {t("s5fc949")}</p></div></div>
        <form className="panelbox" onSubmit={search} noValidate>
          <div className="f2">
            <div className="field">
              <label htmlFor="tNo">{t("se9cc2e")}</label>
              <input id="tNo" value={no} onChange={(e) => setNo(e.target.value)} placeholder={`${checkout.orderPrefix}0001`} dir="ltr" style={{ textAlign: "start" }} autoComplete="off" />
            </div>
            {!signedIn && (
            <div className="field">
              <label htmlFor="tPh">{t("s0947ad")}</label>
              <div className="phone">
                <input id="tPh" type="tel" inputMode="numeric" maxLength={8} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={checkout.phone.placeholder} dir="ltr" />
                <span className="pre">{checkout.phone.prefix}</span>
              </div>
            </div>
            )}
          </div>
          {error && <div className="alert" role="alert"><Icon name="x" size={15} /> {error}</div>}
          <button type="submit" className="btn block" style={{ marginTop: 16 }} disabled={busy} data-testid="track-btn">
            <Icon name="search" size={16} /> {busy ? t("s4276ba") : t("s2678af")}
          </button>
        </form>

        {order && (
          <div className="panelbox" style={{ marginTop: 16 }} data-testid="track-result">
            {stage < 0 ? (
              <div className="statusbar canceled"><div className="ic"><Icon name="x" /></div><div><b>{t("s96c9cd")}</b><span>{t("sbf9c02")} <bdi dir="ltr">{number}</bdi></span></div></div>
            ) : (
              <div className="statusbar">
                <div className="ic"><Icon name={current!.i} /></div>
                <div><b>{current!.t}</b><span>{t("sbf9c02")} <bdi dir="ltr">{number}</bdi> · {order.shipping_name}</span></div>
              </div>
            )}
            {stage >= 0 && stage < 3 && (
              <div className="etasum" style={{ marginTop: 14 }}><Icon name="clock" size={15} /> {t("expectedDelivery")} {deliveryEta(t, locale, order.shipping_code, order.province, new Date(order.times.placed))}</div>
            )}
            {stage >= 0 && (
              <ul className="tl" style={{ marginTop: 16 }}>
                {STEPS.map((s, i) => (
                  <li key={s.t} className={i < stage || (i === 3 && stage === 3) || i === 0 ? "done" : i === stage ? "now" : ""}>
                    <i><Icon name={s.i} size={13} /></i>
                    <div><b>{s.t}</b><span>{s.d}</span></div>
                    <small>{i === 0 ? fmtTime(locale, s.at) : i <= stage ? fmtTime(locale, s.at) : ""}</small>
                  </li>
                ))}
              </ul>
            )}
            <h3 style={{ marginTop: 6 }}>{t("s53bc9e")}</h3>
            {order.items.map((i) => (
              <div key={i.id} className="oline">
                <div className="mini">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="46px" />}</div>
                <div>{i.title}<div className="q">{i.variant?.replace(" / ", " · ")} × {i.quantity}</div></div>
                <span className="pr">{formatAmount(i.unit_price * i.quantity)}</span>
              </div>
            ))}
            <div className="kv" style={{ marginTop: 6 }}><span>{t("s6dc658")}</span><span>{pickup ? t("sd4cab2") : `${governorateName(order.province)} — ${order.city ?? ""}`}</span></div>
            <div className="kv"><span>{t("s88fc73")}</span><span className="num">{formatAmount(order.total)} {CUR}</span></div>
              {order.shipment && (
                <div className="kv" data-testid="track-awb">
                  <span>{t("se84119")}</span>
                  <span>
                    <bdi className="num">{order.shipment.tracking_number}</bdi>
                    {order.shipment.tracking_url && (
                      <> · <a href={order.shipment.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>{t("s071ed7")}</a></>
                    )}
                  </span>
                </div>
              )}
            <div className="helprow">
              {/* منخفضة: لا «تغيير وقت التوصيل» لطلب ملغى (stage < 0) أو مسلَّم (stage 3) */}
              {stage >= 0 && stage < 3 && (
                <a href={`https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(help + t("sfaacdb"))}`} target="_blank" rel="noopener noreferrer"><Icon name="clock" size={14} /> {t("se29980")}</a>
              )}
              <a href={`https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(help)}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={14} /> {t("s11381d")}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
