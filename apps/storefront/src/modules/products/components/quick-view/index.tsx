"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { getQuickProduct } from "@lib/data/quick-product"
import { productAlt } from "@lib/seo/alt"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductActions from "@modules/products/components/product-actions"
import { useT } from "@/i18n/t"

type Loaded = { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion }

/**
 * العرض السريع: الصور والسعر والخيارات وزر الإضافة دون مغادرة القائمة — أدوات الشراء هي نفسها التي في صفحة المنتج
 * (ProductActions بوضع compact: الخيارات المترجمة والمخزون والطول ورسائل الخادم). الجوال: لوح سفلي؛ الكمبيوتر: نافذة بعمودين.
 */
export default function QuickView({ handle, open, onClose }: { handle: string; open: boolean; onClose: () => void }) {
  const t = useT("product")
  const countryCode = useParams().countryCode as string
  const [data, setData] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [img, setImg] = useState(0)

  useEffect(() => {
    if (!open || data) return
    let alive = true
    setFailed(false)
    getQuickProduct(countryCode, handle)
      .then((r) => { if (alive) r ? setData(r) : setFailed(true) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [open, data, countryCode, handle])

  const p = data?.product
  const images = (p?.images?.length ? p.images : p?.thumbnail ? [{ id: "thumb", url: p.thumbnail }] : []) as { id: string; url: string }[]
  const current = images[Math.min(img, images.length - 1)]

  return (
    <Dialog open={open} onClose={onClose} className="qv-root">
      <div className="qv-backdrop" aria-hidden="true" />
      <div className="qv-wrap">
        <DialogPanel className="qv" data-testid="quick-view">
          <button type="button" className="iconbtn qv-x" onClick={onClose} aria-label={t("qvClose")}><Icon name="x" /></button>
          {!p ? (
            <div className="qv-loading" role="status">
              {failed ? t("qvFailed") : <><span className="spin" aria-hidden="true" /> {t("qvLoading")}</>}
            </div>
          ) : (
            <div className="qv-grid">
              <div className="qv-media">
                <div className="qv-main">
                  {current && <Image src={current.url} alt={productAlt(p)} fill sizes="(max-width: 700px) 100vw, 420px" priority />}
                </div>
                {images.length > 1 && (
                  <div className="qv-thumbs">
                    {images.slice(0, 6).map((im, i) => (
                      <button key={im.id} type="button" className={i === img ? "on" : ""} onClick={() => setImg(i)} aria-label={t("qvImage", { n: i + 1 })} aria-pressed={i === img}>
                        <Image src={im.url} alt="" fill sizes="64px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="qv-info pinfo">
                {p.categories?.[0] && <div className="qv-cat">{p.categories[0].name}</div>}
                <DialogTitle as="h2" className="qv-title">{p.title}</DialogTitle>
                <ProductActions product={p} region={data!.region} compact />
                <LocalizedClientLink href={`/products/${p.handle}`} className="qv-more" onClick={onClose}>
                  {t("qvDetails")} <Icon name="arrowL" size={15} />
                </LocalizedClientLink>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
