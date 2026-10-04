"use client"

import { addToCart } from "@lib/data/cart"
import { formatAmount } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import DeliveryEta from "@modules/products/components/delivery-eta"
import { buildMatrix, variantPricing } from "@modules/products/lib/variants"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { storeConfig } from "../../../../store.config"

type Props = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const cfg = storeConfig.product
const waLink = (text: string) =>
  `https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(text)}`

export default function ProductActions({ product, disabled }: Props) {
  const countryCode = useParams().countryCode as string
  const m = useMemo(() => buildMatrix(product), [product])
  const category = product.categories?.[0]?.handle ?? ""
  const singleSize = m.sizes.length <= 1

  const [color, setColor] = useState<string | undefined>(m.colors[0])
  const [size, setSize] = useState<string | undefined>(
    () => m.sizes.find((s) => m.stock(s, m.colors[0]) > 0) ?? m.sizes[0]
  )
  const [qty, setQty] = useState(1)
  const [len, setLen] = useState("")
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const [pageUrl, setPageUrl] = useState("")
  const buyRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const variant = m.find(size, color)
  const left = m.stock(size, color)
  const { price, old } = variantPricing(product, variant)
  const lowStock = left > 0 && left <= cfg.lowStockAt
  const canBuy = !!variant && left > 0 && !disabled
  const hasGuide = !!cfg.sizeGuides[category] && !singleSize
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

  const pickColor = (c: string) => {
    setColor(c)
    if (size && m.stock(size, c) === 0) {
      const alt = m.sizes.find((s) => m.stock(s, c) > 0)
      if (alt) setSize(alt)
    }
  }

  const selectionText = [
    !singleSize && size ? `المقاس ${size}` : null,
    color ? `اللون ${color}` : null,
    wantsLength && len ? `الطول ${len} سم` : null,
  ].filter(Boolean).join("، ")

  const handleAdd = async () => {
    if (!variant?.id || !canBuy) {
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setAdding(true)
    try {
      await addToCart({
        variantId: variant.id,
        quantity: qty,
        countryCode,
        metadata: wantsLength && len ? { length_cm: Number(len) } : undefined,
      })
      setToast({ ok: true, msg: `أُضيفت إلى السلة${selectionText ? ` — ${selectionText}` : ""}` })
    } catch (e: any) {
      setToast({ ok: false, msg: e?.message?.includes("inventory") ? "الكمية المطلوبة غير متوفرة حالياً" : "تعذّرت الإضافة للسلة، حاولي مرة أخرى" })
    } finally {
      setAdding(false)
    }
  }

  // الرابط يُقرأ بعد التحميل فقط (pageUrl) حتى تتطابق نسخة الخادم مع المتصفح
  const waOrder = () =>
    waLink(
      `مرحباً ${storeConfig.shortName}، أرغب بطلب:\n${product.title}\n${selectionText}\nالكمية: ${qty}\nالسعر: ${formatAmount(price * qty)} ${storeConfig.currencyLabel}${pageUrl ? `\n${pageUrl}` : ""}`
    )
  const waNotify = () =>
    waLink(`مرحباً ${storeConfig.shortName}، أرجو إعلامي عند توفر ${product.title} (${selectionText}).`)
  const waAtelier = (kind: "custom" | "fitting") =>
    waLink(
      kind === "custom"
        ? `مرحباً ${storeConfig.shortName}، أرغب بتفصيل ${product.title} على مقاسي.`
        : `مرحباً ${storeConfig.shortName}، أرغب بحجز موعد قياس في المشغل لـ ${product.title}.`
    )

  return (
    <>
      <div className="pricebox">
        <Money amount={price} />
        {old && (
          <>
            <span className="old num">{formatAmount(old)}</span>
            <span className="saveflag">وفّري {formatAmount(old - price)} {storeConfig.currencyLabel}</span>
          </>
        )}
        <span className="vat">
          السعر شامل ضريبة القيمة المضافة
          {sold >= 5 && <span className="hot"><Icon name="fire" size={12} /> اشترتها {sold} زبونة هذا الأسبوع</span>}
        </span>
      </div>

      {cfg.bnpl.enabled && price > 0 && (
        <div className="bnpl">
          <div className="tx">
            <strong>{cfg.bnpl.installments} دفعات × {formatAmount(price / cfg.bnpl.installments)} {storeConfig.currencyLabel}</strong>
            بلا فوائد أو رسوم
          </div>
        </div>
      )}

      <DeliveryEta />

      <div className="selbox" ref={boxRef}>
        {m.colors.length > 0 && (
          <>
            <div className="label"><span>اللون: <b>{color}</b></span></div>
            <div className="opts" role="radiogroup" aria-label="اللون">
              {m.colors.map((c) => {
                const sw = cfg.swatches[c] ?? ["#cccccc", "#999999"]
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={c === color}
                    aria-label={c}
                    title={c}
                    className={`dot ${c === color ? "on" : ""}`}
                    style={{ background: `linear-gradient(150deg, ${sw[0]}, ${sw[1]})` }}
                    onClick={() => pickColor(c)}
                    disabled={disabled}
                  />
                )
              })}
            </div>
          </>
        )}

        {m.sizes.length > 0 && (
          <>
            <div className="label">
              <span>
                المقاس: <b>{size}</b>
                {lowStock && <span className="lowstock"> · بقي {left} فقط</span>}
              </span>
              {hasGuide && (
                <a
                  href="#size-guide"
                  onClick={() => { const d = document.getElementById("size-guide") as HTMLDetailsElement | null; if (d) d.open = true }}
                >
                  <Icon name="ruler" size={13} /> دليل المقاسات
                </a>
              )}
            </div>
            {!singleSize && (
              <div className="opts" role="radiogroup" aria-label="المقاس">
                {m.sizes.map((s) => {
                  const st = m.stock(s, color)
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={s === size}
                      className={`size ${s === size ? "on" : ""} ${st === 0 ? "out" : st <= cfg.lowStockAt ? "low" : ""}`}
                      title={st === 0 ? "نفد — اطلبي إشعاراً عند التوفر" : st <= cfg.lowStockAt ? `بقي ${st} فقط` : undefined}
                      onClick={() => setSize(s)}
                      disabled={disabled}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {variant && left === 0 && (
          <div className="notice warn"><Icon name="bell" size={15} /> {singleSize ? "هذا اللون" : `المقاس ${size}`} نفد حالياً — نخبرك فور توفره</div>
        )}

        {wantsLength && (
          <>
            <div className="label"><label htmlFor="lenIn">طولك بالسنتيمتر (اختياري)</label></div>
            <div className="lenfield">
              <input
                id="lenIn"
                type="number"
                inputMode="numeric"
                min={120}
                max={200}
                placeholder="مثال: 160"
                value={len}
                onChange={(e) => setLen(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
              <span><Icon name="check" size={12} /> {cfg.lengthField.note}</span>
            </div>
          </>
        )}

        <div className="buyrow" ref={buyRef}>
          <div className="qty" aria-label="الكمية">
            <button type="button" aria-label="إنقاص" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Icon name="minus" /></button>
            <b className="num" aria-live="polite">{qty}</b>
            <button type="button" aria-label="زيادة" onClick={() => setQty((q) => Math.min(q + 1, Math.max(1, left)))} disabled={!canBuy || qty >= left}><Icon name="plus" /></button>
          </div>
          {variant && left === 0 ? (
            <a className="btn copper block" href={waNotify()} target="_blank" rel="noopener noreferrer">
              <Icon name="bell" size={17} /> أعلميني عند التوفر
            </a>
          ) : (
            <button type="button" className="btn block" onClick={handleAdd} disabled={!canBuy || adding} data-testid="add-product-button">
              <Icon name="bag" size={17} /> {adding ? "جارٍ الإضافة…" : "إضافة للسلة"}
              {!adding && price > 0 && <span className="bp num"> · {formatAmount(price * qty)} {storeConfig.currencyLabel}</span>}
            </button>
          )}
        </div>

        {canBuy && (
          <a className="btn wa block warow" href={waOrder()} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={18} /> اطلبي عبر واتساب
          </a>
        )}

        <div className="stockrow">
          <span><i className={left > 0 ? "" : "off"} />{left > 0 ? "متوفر في المشغل — جرّبيها قبل الشراء" : "سنعيد توفيره قريباً"}</span>
          <span><Icon name="shield" size={13} /> دفع آمن · استبدال 14 يوماً</span>
        </div>
      </div>

      {cfg.atelier.categories.includes(category) && (
        <div className="atelier">
          <a className="pill" href={waAtelier("custom")} target="_blank" rel="noopener noreferrer"><Icon name="scissors" size={14} /> تفصيل على مقاسك</a>
          <a className="pill" href={waAtelier("fitting")} target="_blank" rel="noopener noreferrer"><Icon name="clock" size={14} /> احجزي قياساً في المشغل</a>
        </div>
      )}

      <div className={`stickybuy ${showSticky ? "show" : ""}`} aria-hidden={!showSticky}>
        <div className="min-w-0">
          <div className="muted st-name">{product.title}</div>
          <Money amount={price * qty} />
        </div>
        <button type="button" className="btn" onClick={handleAdd} disabled={!canBuy || adding} tabIndex={showSticky ? 0 : -1}>
          <Icon name="bag" size={16} /> {variant && left === 0 ? "غير متوفر" : "إضافة للسلة"}
        </button>
      </div>

      <div className={`ptoast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast && (
          <span className={toast.ok ? "" : "err"}>
            <Icon name={toast.ok ? "check" : "x"} size={16} /> {toast.msg}
            {toast.ok && <LocalizedClientLink href="/cart" className="tlink">عرض السلة</LocalizedClientLink>}
          </span>
        )}
      </div>
    </>
  )
}
