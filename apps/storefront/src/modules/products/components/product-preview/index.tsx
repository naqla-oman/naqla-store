import Image from "next/image"
import { productAlt } from "@lib/seo/alt"
import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import WishButton from "@modules/common/components/wish-button"
import QuickActions from "@modules/products/components/quick-actions"
import { storeConfig } from "../../../../store.config"
import { getLocale } from "next-intl/server"
import { getT } from "@/i18n/t"

export default async function ProductPreview({
  product,
  region,
  priority = false,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
  /** منخفضة (LCP): أول بطاقتين في القائمة تُحمَّلان بأولوية — أولاهما أكبر عنصر على الجوال */
  priority?: boolean
}) {
  const t = await getT("product")
  const locale = await getLocale()
  const TAG: Record<string, string> = { new: t("sc590a3"), bestsellers: t("se5a09c"), sale: t("s35b0c8") }
  const { cheapestPrice } = getProductPrice({ locale, product })
  const meta = (product.metadata || {}) as Record<string, any>
  const price = cheapestPrice?.calculated_price_number ?? 0
  // M26: سعر قائمة أسعار «تخفيض» من Medusa أولاً (أداة التخفيضات في اللوحة)، ثم compare_at في البيانات
  const sale = cheapestPrice?.price_type === "sale" ? Number(cheapestPrice.original_price_number) : null
  const old: number | null = sale && sale > price ? sale : meta.compare_at_price ?? null
  const cur = region.currency_code
  const tag = product.collection?.handle ? TAG[product.collection.handle] : null
  const pct = old && old > price ? Math.round((1 - price / old) * 100) : 0
  const cat = product.categories?.[0]?.name

  const href = `/products/${product.handle}`
  // البطاقة عنصر div: الأزرار (المفضلة، الإضافة والعرض السريعان) لا تكون داخل رابط — الصورة والنص رابطان منفصلان
  return (
    <div className="pcard" data-testid="product-wrapper">
      <div className="ph">
        <LocalizedClientLink href={href} className="phlink" tabIndex={-1} aria-hidden="true">
          {product.thumbnail && (
            <Image src={product.thumbnail} alt={productAlt(product)} fill priority={priority} sizes="(max-width: 700px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          )}
        </LocalizedClientLink>
        {pct > 0 ? <span className="tag red"><bdi dir="ltr">-{pct}%</bdi></span> : tag ? <span className="tag">{tag}</span> : null}
        <WishButton productId={product.id} />
        <QuickActions product={product} />
      </div>
      <LocalizedClientLink href={href} className="pb">
        {cat && <div className="cat">{cat}</div>}
        <div className="nm" data-testid="product-title">{product.title}</div>
        {storeConfig.features.reviews && meta.rating && (
          <div className="meta">
            <span className="st"><Icon name="star" size={12} /> {meta.rating}</span>
            {meta.reviews && <span>({meta.reviews})</span>}
          </div>
        )}
        {meta.sold_week >= 15 && <div className="sold"><Icon name="fire" size={12} /> <span>{t("soldThisWeek", { count: meta.sold_week })}</span></div>}
        <div className="pr">
          <span className="price" data-testid="price">{convertToLocale({ amount: price, currency_code: cur, locale })}</span>
          {old && old > price && (
            <>
              <span className="old">{convertToLocale({ amount: old, currency_code: cur, locale })}</span>
              <span className="save">{t("sc1aa3c")} {convertToLocale({ amount: old - price, currency_code: cur, locale })}</span>
            </>
          )}
        </div>
      </LocalizedClientLink>
    </div>
  )
}
