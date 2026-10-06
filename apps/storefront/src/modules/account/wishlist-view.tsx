"use client"

import Image from "next/image"
import { WishProduct, wishlistProducts } from "@lib/data/account"
import { useWishlist } from "@lib/context/wishlist"
import { formatAmount } from "@lib/util/money"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import WishButton from "@modules/common/components/wish-button"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { storeConfig } from "../../store.config"
import { g } from "@lib/voice"
import { products as nProducts, pieces as nPieces } from "@lib/util/plural"

/** صفحة المفضلة — تعمل للضيفات (من المتصفح) وللمسجّلات (من الحساب) */
export default function WishlistView() {
  const { ids, loggedIn } = useWishlist()
  const { countryCode } = useParams() as { countryCode: string }
  const [items, setItems] = useState<WishProduct[] | null>(null)
  const key = ids.join(",")

  useEffect(() => {
    let live = true
    wishlistProducts(ids, countryCode).then((r) => { if (live) setItems(r) })
    return () => { live = false }
  }, [key, countryCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (items ?? []).filter((p) => ids.includes(p.id))

  return (
    <div className="wrap" style={{ paddingBottom: 28 }}>
      <div className="secthead"><div><h1>المفضلة</h1><p>{nProducts(ids.length)} محفوظة{!loggedIn && ids.length ? " على هذا الجهاز" : ""}</p></div></div>
      {!loggedIn && ids.length > 0 && (
        <div className="guest" style={{ marginBottom: 16 }}>
          <Icon name="user" size={15} /> <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>{g("ادخلي برقمك", "ادخل برقمك")}</LocalizedClientLink> لحفظ مفضلتك على كل أجهزتك
        </div>
      )}
      {items === null ? (
        <div className="empty">جارٍ التحميل…</div>
      ) : !shown.length ? (
        <div className="empty">
          <Icon name="heart" size={46} />
          <p>{g("لم تحفظي أي منتج بعد — اضغطي على القلب فوق أي منتج يعجبك", "لم تحفظ أي منتج بعد — اضغط على القلب فوق أي منتج يعجبك")}</p>
          <LocalizedClientLink href="/store" className="btn">{g("تصفحي المنتجات", "تصفح المنتجات")}</LocalizedClientLink>
        </div>
      ) : (
        <div className="pgrid" data-testid="wishlist-grid">
          {shown.map((p) => (
            <LocalizedClientLink key={p.id} href={`/products/${p.handle}`} className="pcard">
              <div className="ph">
                {p.thumbnail && <Image src={p.thumbnail} alt={p.title} fill sizes="(max-width: 700px) 50vw, 25vw" />}
                <WishButton productId={p.id} />
              </div>
              <div className="pb">
                {p.category && <div className="cat">{p.category}</div>}
                <div className="nm">{p.title}</div>
                <div className="pr">
                  <span className="price">{formatAmount(p.price)} {storeConfig.currencyLabel}</span>
                  {p.old && <span className="old">{formatAmount(p.old)}</span>}
                </div>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      )}
    </div>
  )
}
