"use client"

import { track } from "@lib/tracking/events"
import { addToCart } from "@lib/data/cart"
import { formatAmount } from "@lib/util/money"
import { g } from "@lib/voice"
import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams } from "next/navigation"
import { FormEvent, useState } from "react"
import { storeConfig } from "../../../../store.config"

type Props = {
  /** القطعة التي يُطلب تفصيلها */
  product: HttpTypes.StoreProduct
  /** منتج الخدمة «تفصيل خاص» بأسعاره */
  service: HttpTypes.StoreProduct
}

const T = storeConfig.tailoring!
const CUR = storeConfig.currencyLabel

/**
 * «تفصيل على مقاسك»: اختيار الخدمة المناسبة لقسم القطعة + المقاسات (أو طلب التواصل لأخذها)،
 * ثم إضافة الخدمة للسلة ببياناتها في metadata.tailoring (تظهر في السلة والطلب ولوحة التحكم).
 */
export default function Tailoring({ product, service }: Props) {
  const { countryCode } = useParams() as { countryCode: string }
  const category = product.categories?.[0]?.handle ?? ""
  const offered = T.services.filter((s) => s.categories.includes(category))
  const variants = offered
    .map((s) => ({ s, v: service.variants?.find((v) => (v.metadata as any)?.service_key === s.key) }))
    .filter((x) => x.v)

  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(variants[0]?.s.key)
  const [m, setM] = useState<Record<string, string>>({})
  const [contact, setContact] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  if (!variants.length) return null
  const chosen = variants.find((x) => x.s.key === key) ?? variants[0]
  const price = chosen.v!.calculated_price?.calculated_amount ?? chosen.s.price
  const disc = T.discountTier

  const valid = contact || T.measurements.every((d) => {
    const n = Number(m[d.key])
    return n >= 10 && n <= 250
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) {
      setMsg({ ok: false, t: g("أدخلي كل المقاسات بالسنتيمتر أو اختاري «تواصلوا معي»", "أدخل كل المقاسات بالسنتيمتر أو اختر «تواصلوا معي»") })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await addToCart({
        variantId: chosen.v!.id,
        quantity: 1,
        countryCode,
        metadata: {
          tailoring: {
            for: product.title,
            for_handle: product.handle,
            contact,
            measurements: contact ? null : Object.fromEntries(T.measurements.map((d) => [d.key, Number(m[d.key])])),
          },
        },
      })
      track("add_to_cart", { value: price, items: [{ id: chosen.v!.id, name: chosen.s.title, price, quantity: 1, category: chosen.s.title }] })
      setMsg({ ok: true, t: `أُضيف «${chosen.s.title}» إلى السلة` })
      setM({})
    } catch {
      setMsg({ ok: false, t: g("تعذّرت الإضافة، حاولي مرة أخرى", "تعذّرت الإضافة، حاول مرة أخرى") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tailor" data-testid="tailoring">
      <button type="button" className={`pill ${open ? "on" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="tailoring-toggle">
        <Icon name="scissors" size={14} /> تفصيل على مقاسك
      </button>
      {open && (
        <form className="tailor-panel" onSubmit={submit} noValidate>
          <div className="label"><span>{T.title}</span></div>
          <div className="tailor-opts" role="radiogroup" aria-label="الخدمة">
            {variants.map(({ s, v }) => (
              <button key={s.key} type="button" role="radio" aria-checked={s.key === chosen.s.key} className={`payopt ${s.key === chosen.s.key ? "on" : ""}`} onClick={() => setKey(s.key)} data-testid={`tailor-${s.key}`}>
                <span className="t"><b>{s.title}</b></span>
                <span className="pr">{formatAmount(v!.calculated_price?.calculated_amount ?? s.price)} {CUR}</span>
                <span className="mark" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="tailor-m">
            {T.measurements.map((d) => (
              <div key={d.key} className="field">
                <label htmlFor={`tm-${d.key}`}>{d.label} (سم)</label>
                <input id={`tm-${d.key}`} type="number" inputMode="numeric" min={10} max={250} value={m[d.key] ?? ""} disabled={contact}
                  onChange={(e) => setM((x) => ({ ...x, [d.key]: e.target.value.replace(/\D/g, "").slice(0, 3) }))} />
              </div>
            ))}
          </div>
          <label className="tailor-contact">
            <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} data-testid="tailor-contact" />
            تواصلوا معي لأخذ المقاسات
          </label>

          {disc && (
            <div className="guest copper"><Icon name="sparkle" size={14} /> {g(
              `للعضوات ال${disc.name.replace(/ة$/, "ات")}`,
              `للأعضاء ال${disc.name.replace(/ية$/, "يين")}`,
              `لأصحاب العضوية ال${disc.name}`
            )}: خصم {disc.tailoringDiscount}٪ على التفصيل تلقائياً في السلة</div>
          )}
          {msg && (
            <div className={msg.ok ? "okmsg" : "ferr-inline"} role="status">
              {msg.t}{msg.ok && <> — <LocalizedClientLink href="/cart" style={{ textDecoration: "underline" }}>عرض السلة</LocalizedClientLink></>}
            </div>
          )}
          <button type="submit" className="btn block" disabled={busy} style={{ marginTop: 12 }} data-testid="tailor-add">
            <Icon name="scissors" size={16} /> {busy ? "جارٍ الإضافة…" : `إضافة ${chosen.s.title} للسلة · ${formatAmount(price)} ${CUR}`}
          </button>
        </form>
      )}
    </div>
  )
}
