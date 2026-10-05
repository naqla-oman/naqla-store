"use client"

import Image from "next/image"
import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { g } from "@lib/voice"
import { tailoringNote } from "@lib/util/tailoring"

const maxQty = (i: HttpTypes.StoreCartLineItem) => {
  const v = i.variant
  if (!v || !v.manage_inventory || v.allow_backorder) return 10
  return Math.max(1, Math.min(10, v.inventory_quantity ?? 1))
}

/** أسطر السلة مع تعديل الكمية والإزالة */
export default function CartLines({ items }: { items: HttpTypes.StoreCartLineItem[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()

  const run = (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    start(async () => {
      try {
        const r = (await fn()) as { ok?: boolean; message?: string } | undefined
        // M25: رسالة الخادم (الكمية غير متوفرة…) تصل في الإنتاج
        if (r && r.ok === false) {
          setError(r.message ?? g("تعذّر تحديث السلة، حاولي مرة أخرى", "تعذّر تحديث السلة، حاول مرة أخرى"))
          return
        }
        router.refresh()
      } catch {
        setError(g("تعذّر تحديث السلة، حاولي مرة أخرى", "تعذّر تحديث السلة، حاول مرة أخرى"))
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <div>
      {error && <div className="alert" role="alert"><Icon name="x" size={15} /> {error}</div>}
      {items
        .slice()
        .sort((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1)
        .map((i) => {
          const len = (i.metadata as any)?.length_cm
          const max = maxQty(i)
          return (
            <div key={i.id} className={`cartline ${busy === i.id ? "busy" : ""}`} data-testid="cart-item">
              <LocalizedClientLink href={`/products/${i.product_handle}`} className="mini">
                {i.thumbnail && <Image src={i.thumbnail} alt={i.product_title ?? ""} fill sizes="72px" />}
              </LocalizedClientLink>
              <div className="info">
                <LocalizedClientLink href={`/products/${i.product_handle}`} className="cname">{i.product_title}</LocalizedClientLink>
                <div className="opt">{i.variant_title?.replace(" / ", " · ")}{len ? ` · طول ${len} سم` : ""}</div>
                {tailoringNote(i.metadata) && <div className="opt tnote" data-testid="tailoring-note">{tailoringNote(i.metadata)}</div>}
                <div className="row">
                  <div className="qty" aria-label="الكمية">
                    <button type="button" aria-label="إنقاص" disabled={i.quantity <= 1} onClick={() => run(i.id, () => updateLineItem({ lineId: i.id, quantity: i.quantity - 1 }))}><Icon name="minus" /></button>
                    <b className="num">{i.quantity}</b>
                    <button type="button" aria-label="زيادة" disabled={i.quantity >= max} onClick={() => run(i.id, () => updateLineItem({ lineId: i.id, quantity: i.quantity + 1 }))}><Icon name="plus" /></button>
                  </div>
                  <Money amount={i.unit_price * i.quantity} />
                </div>
                <button type="button" className="rm" onClick={() => run(i.id, () => deleteLineItem(i.id))}><Icon name="trash" size={13} /> إزالة</button>
              </div>
            </div>
          )
        })}
    </div>
  )
}
