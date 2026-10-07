"use client"

import { itemOf, track } from "@lib/tracking/events"
import { addToCart } from "@lib/data/cart"
import { formatAmount } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import DeliveryEta from "@modules/products/components/delivery-eta"
import { buildMatrix, Selection, variantPricing } from "@modules/products/lib/variants"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { storeConfig } from "../../../../store.config"
import { useCurrencyLabel, useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

type Props = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const waLink = (text: string) =>
  `https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(text)}`

export default function ProductActions({ product, disabled }: Props) {
  const sc = useStoreConfig()
  const cfg = sc.product
  const t = useT("product")
  const CUR = useCurrencyLabel()
  const countryCode = useParams().countryCode as string
  const m = useMemo(() => buildMatrix(product), [product])
  const category = product.categories?.[0]?.handle ?? ""
  const [sel, setSel] = useState<Selection>(() => m.initial())
  const [qty, setQty] = useState(1)
  const [len, setLen] = useState("")
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const [pageUrl, setPageUrl] = useState("")
  const buyRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const variant = m.find(sel)
  const left = variant ? m.stock(sel) : 0
  const { price, old } = variantPricing(product, variant)
  const lowStock = left > 0 && left <= cfg.lowStockAt
  const canBuy = !!variant && left > 0 && !disabled
  // دليل المقاسات يرافق أول خيار من نوع أزرار له أكثر من قيمة، إن وُجد جدول لقسم المنتج
  const guideKey = cfg.sizeGuides[category] ? m.defs.find((d) => d.type === "buttons" && d.values.length > 1)?.key : undefined
  const wantsLength = cfg.lengthField.categories.includes(category)
  const sold = Number((product.metadata as any)?.sold_week) || 0

  // الكمية لا تتجاوز المتاح عند تغيير الاختيار
  useEffect(() => { setQty((q) => Math.max(1, Math.min(q, left || 1))) }, [left])

  // مزامنة المتغيّر في الرابط دون إعادة تحميل الصفحة (للمشاركة)
  useEffect(() => {
    if (!variant?.id) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("v_id") === variant.id) { setPageUrl(url.toString()); return }
    url.searchParams.set("v_id", variant.id)
    window.history.replaceState(null, "", url.toString())
    setPageUrl(url.toString())
  }, [variant?.id])

  // شريط الشراء المثبّت يظهر عندما يخرج زر الإضافة من الشاشة
  useEffect(() => {
    let raf = 0
    const check = () => {
      raf = 0
      const el = buyRef.current
      if (el) setShowSticky(el.getBoundingClientRect().bottom < 0)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check) }
    window.addEventListener("scroll", onScroll, { passive: true })
    check()
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // اختيار قيمة: إن نفدت التركيبة الناتجة نعدّل بقية الخيارات إلى أقرب تركيبة متوفرة
  const pick = (key: string, value: string) => {
    let next: Selection = { ...sel, [key]: value }
    if (m.stock(next) === 0) {
      for (const d of m.defs) {
        if (d.key === key) continue
        const alt = d.values.find((v) => m.stock({ ...next, [d.key]: v }) > 0)
        if (alt) next = { ...next, [d.key]: alt }
      }
    }
    setSel(next)
  }

  const selectionText = [
    ...m.defs.filter((d) => d.values.length > 1 || m.defs.length > 1).map((d) => (sel[d.key] ? `${d.title} ${sel[d.key]}` : null)),
    wantsLength && len ? t("lengthCm", { len }) : null,
  ].filter(Boolean).join(t("s8a78cc"))

  // view_item مرة لكل منتج (يتجدد السعر مع المتغيّر المختار عند الإضافة)
  useEffect(() => {
    track("view_item", { value: price, items: [itemOf(product, variant, price)] })
  }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!variant?.id || !canBuy) {
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    // M24: الطول ضمن النطاق (والخادم يتحقق أيضاً)
    const lmin = Number((cfg.lengthField as any).min ?? 120)
    const lmax = Number((cfg.lengthField as any).max ?? 200)
    if (wantsLength && len && (Number(len) < lmin || Number(len) > lmax)) {
      setToast({ ok: false, msg: t("lengthRange", { lmin, lmax }) })
      document.getElementById("lenIn")?.focus()
      return
    }
    setAdding(true)
    try {
      const r = await addToCart({
        variantId: variant.id,
        quantity: qty,
        countryCode,
        metadata: wantsLength && len ? { length_cm: Number(len) } : undefined,
      })
      // M25: النتيجة بدل الاستثناء — الرسالة تصل في الإنتاج
      if (!r.ok) {
        setToast({ ok: false, msg: r.message })
        return
      }
      track("add_to_cart", { value: price * qty, items: [itemOf(product, variant, price, qty)] })
      setToast({ ok: true, msg: `${t("addedToCart")}${selectionText ? ` — ${selectionText}` : ""}` })
    } catch (e: any) {
      setToast({ ok: false, msg: e?.message?.includes("inventory") ? t("s68650b") : t("sf1d17a") })
    } finally {
      setAdding(false)
    }
  }

  // الرابط يُقرأ بعد التحميل فقط (pageUrl) حتى تتطابق نسخة الخادم مع المتصفح
  const waOrder = () =>
    waLink(
      t("waOrder", { store: sc.shortName, title: product.title, selection: selectionText, qty, price: `${formatAmount(price * qty)} ${CUR}` }) + (pageUrl ? `\n${pageUrl}` : "")
    )
  const waNotify = () =>
    waLink(t("waNotify", { store: sc.shortName, title: product.title, selection: selectionText }))
  const waAtelier = (kind: "custom" | "fitting") =>
    waLink(
      kind === "custom"
        ? t("waTailor", { store: sc.shortName, title: product.title })
        : t("waFitting", { store: sc.shortName, title: product.title })
    )

  return (
    <>
      <div className="pricebox">
        <Money amount={price} />
        {old && (
          <>
            <span className="old num">{formatAmount(old)}</span>
            <span className="saveflag">{t("save", { amount: `${formatAmount(old - price)} ${CUR}` })}</span>
          </>
        )}
        <span className="vat">
          {t("scdc880")}
          {sold >= 5 && <span className="hot"><Icon name="fire" size={12} /> {t("soldThisWeek", { count: sold })}</span>}
        </span>
      </div>

      {cfg.bnpl.enabled && price > 0 && (
        <div className="bnpl">
          <div className="tx">
            <strong>{t("installments", { n: cfg.bnpl.installments, amount: `${formatAmount(price / cfg.bnpl.installments)} ${CUR}` })}</strong>
            {t("s8274ca")}
          </div>
        </div>
      )}

      <DeliveryEta />

      <div className="selbox" ref={boxRef}>
        {m.defs.map((d) => {
          const single = d.values.length <= 1
          return (
            <div key={d.key}>
              <div className="label">
                <span>
                  {d.title}: <b>{sel[d.key]}</b>
                  {d.key === m.defs[m.defs.length - 1].key && lowStock && <span className="lowstock"> · {t("onlyLeft", { n: left })}</span>}
                </span>
                {d.key === guideKey && (
                  <a
                    href="#size-guide"
                    onClick={() => { const g = document.getElementById("size-guide") as HTMLDetailsElement | null; if (g) g.open = true }}
                  >
                    <Icon name="ruler" size={13} /> {t("sizeGuide")}
                  </a>
                )}
              </div>
              {!single && (
                <div className="opts" role="radiogroup" aria-label={d.title}>
                  {d.values.map((v) => {
                    const st = m.stock({ ...sel, [d.key]: v })
                    const on = v === sel[d.key]
                    // دوائر ألوان فقط لخيار من نوع لون
                    if (d.type === "color") {
                      const sw = d.swatches?.[v]
                      return (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={v}
                          title={st === 0 ? t("soldOutV", { v }) : v}
                          className={`dot ${on ? "on" : ""} ${st === 0 ? "out" : ""}`}
                          onClick={() => pick(d.key, v)}
                          disabled={disabled}
                        >
                          {/* منخفضة: الزر 44px للمس، والدائرة الظاهرة 36px بداخله */}
                          <span className="sw" style={{ background: sw ? `linear-gradient(150deg, ${sw[0]}, ${sw[1]})` : "linear-gradient(150deg, var(--line), var(--muted))" }} />
                        </button>
                      )
                    }
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`size ${on ? "on" : ""} ${st === 0 ? "out" : st <= cfg.lowStockAt ? "low" : ""}`}
                        title={st === 0 ? t("sbda1b9") : st <= cfg.lowStockAt ? t("onlyLeft", { n: st }) : undefined}
                        onClick={() => pick(d.key, v)}
                        disabled={disabled}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {variant && left === 0 && (
          <div className="notice warn"><Icon name="bell" size={15} /> {t("s374125")}</div>
        )}

        {wantsLength && (
          <>
            <div className="label"><label htmlFor="lenIn">{t("s9aecaf")}</label></div>
            <div className="lenfield">
              <input
                id="lenIn"
                type="number"
                inputMode="numeric"
                min={Number((cfg.lengthField as any).min ?? 120)}
                max={Number((cfg.lengthField as any).max ?? 200)}
                aria-invalid={!!len && (Number(len) < Number((cfg.lengthField as any).min ?? 120) || Number(len) > Number((cfg.lengthField as any).max ?? 200))}
                placeholder={t("s1608e0")}
                value={len}
                onChange={(e) => setLen(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
              <span><Icon name="check" size={12} /> {cfg.lengthField.note}</span>
            </div>
          </>
        )}

        <div className="buyrow" ref={buyRef}>
          <div className="qty" aria-label={t("s510165")}>
            <button type="button" aria-label={t("scc05a0")} onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Icon name="minus" /></button>
            <b className="num" aria-live="polite">{qty}</b>
            <button type="button" aria-label={t("s6a8330")} onClick={() => setQty((q) => Math.min(q + 1, Math.max(1, left)))} disabled={!canBuy || qty >= left}><Icon name="plus" /></button>
          </div>
          {variant && left === 0 ? (
            <a className="btn copper block" href={waNotify()} target="_blank" rel="noopener noreferrer">
              <Icon name="bell" size={17} /> {t("s3a961d")}
            </a>
          ) : (
            <button type="button" className="btn block" onClick={handleAdd} disabled={!canBuy || adding} data-testid="add-product-button">
              <Icon name="bag" size={17} /> {adding ? t("s6bfc32") : t("s8ed342")}
              {!adding && price > 0 && <span className="bp num"> · {formatAmount(price * qty)} {CUR}</span>}
            </button>
          )}
        </div>

        {canBuy && sc.features.whatsappOrder && (
          <a className="btn wa block warow" href={waOrder()} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={18} /> {t("saa3776")}
          </a>
        )}

        <div className="stockrow">
          <span><i className={left > 0 ? "" : "off"} />{left > 0 ? cfg.availability.inStock : cfg.availability.outOfStock}</span>
          <span><Icon name="shield" size={13} /> {t("s65df19")}</span>
        </div>
      </div>

      {cfg.atelier.categories.includes(category) && (
        <div className="atelier">
          <a className="pill" href={waAtelier("fitting")} target="_blank" rel="noopener noreferrer"><Icon name="clock" size={14} /> {t("s4ba6f3")}</a>
        </div>
      )}

      <div className={`stickybuy ${showSticky ? "show" : ""}`} aria-hidden={!showSticky}>
        <div className="min-w-0">
          <div className="muted st-name">{product.title}</div>
          <Money amount={price * qty} />
        </div>
        <button type="button" className="btn" onClick={handleAdd} disabled={!canBuy || adding} tabIndex={showSticky ? 0 : -1}>
          <Icon name="bag" size={16} /> {variant && left === 0 ? t("s5883c3") : t("s8ed342")}
        </button>
      </div>

      <div className={`ptoast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast && (
          <span className={toast.ok ? "" : "err"}>
            <Icon name={toast.ok ? "check" : "x"} size={16} /> {toast.msg}
            {toast.ok && <LocalizedClientLink href="/cart" className="tlink">{t("s8fc546")}</LocalizedClientLink>}
          </span>
        )}
      </div>
    </>
  )
}
