"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { HttpTypes } from "@medusajs/types"
import { addToCart } from "@lib/data/cart"
import { itemOf, track } from "@lib/tracking/events"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import QuickView from "@modules/products/components/quick-view"
import { variantPricing } from "@modules/products/lib/variants"
import { useStoreConfig } from "@/i18n/store-config"
import { useT } from "@/i18n/t"

/**
 * زرّا البطاقة: «إضافة سريعة» و«عرض سريع».
 * منتج بخيار واحد (ولا يطلب طولاً) يُضاف مباشرة؛ ذو المقاسات/الألوان يفتح العرض السريع لاختيارها أولاً.
 */
export default function QuickActions({ product }: { product: HttpTypes.StoreProduct }) {
  const t = useT("product")
  const sc = useStoreConfig()
  const countryCode = useParams().countryCode as string
  const [view, setView] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const variants = product.variants ?? []
  const category = product.categories?.[0]?.handle ?? ""
  const direct = variants.length === 1 && !sc.product.lengthField.categories.includes(category)

  const quickAdd = async () => {
    if (!direct) return setView(true)
    const v = variants[0]
    setBusy(true)
    try {
      const r = await addToCart({ variantId: v.id, quantity: 1, countryCode })
      if (!r.ok) return setToast({ ok: false, msg: r.message })
      const { price } = variantPricing(product, v)
      track("add_to_cart", { value: price, items: [itemOf(product, v, price)] })
      setToast({ ok: true, msg: t("addedToCart") })
    } catch {
      setToast({ ok: false, msg: t("sf1d17a") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="qa">
        <button type="button" className="qa-add" onClick={quickAdd} disabled={busy} aria-label={t("qaAddAria", { title: product.title ?? "" })} data-testid="quick-add">
          <Icon name="bag" size={16} />
          <span>{busy ? t("s6bfc32") : t("qaAdd")}</span>
        </button>
        <button type="button" className="qa-view" onClick={() => setView(true)} aria-label={t("qaViewAria", { title: product.title ?? "" })} title={t("qaView")} data-testid="quick-view-button">
          <Icon name="eye" size={17} />
        </button>
      </div>
      {view && <QuickView handle={product.handle!} open={view} onClose={() => setView(false)} />}
      {mounted && toast && createPortal(
        <div className="ptoast show" role="status" aria-live="polite">
          <span className={toast.ok ? "" : "err"}>
            <Icon name={toast.ok ? "check" : "x"} size={16} /> {toast.msg}
            {toast.ok && <LocalizedClientLink href="/cart" className="tlink">{t("s8fc546")}</LocalizedClientLink>}
          </span>
        </div>,
        document.body
      )}
    </>
  )
}
