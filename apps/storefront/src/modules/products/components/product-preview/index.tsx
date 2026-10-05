import Image from "next/image"
import { productAlt } from "@lib/seo/alt"
import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import WishButton from "@modules/common/components/wish-button"
import { storeConfig } from "../../../../store.config"
import { g } from "@lib/voice"

const TAG: Record<string, string> = { new: "جديد", bestsellers: "الأكثر مبيعاً", sale: "خصم" }

export default async function ProductPreview({
  product,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({ product })
  const meta = (product.metadata || {}) as Record<string, any>
  const price = cheapestPrice?.calculated_price_number ?? 0
  // M26: سعر قائمة أسعار «تخفيض» من Medusa أولاً (أداة التخفيضات في اللوحة)، ثم compare_at في البيانات
  const sale = cheapestPrice?.price_type === "sale" ? Number(cheapestPrice.original_price_number) : null
  const old: number | null = sale && sale > price ? sale : meta.compare_at_price ?? null
  const cur = region.currency_code
  const tag = product.collection?.handle ? TAG[product.collection.handle] : null
  const pct = old && old > price ? Math.round((1 - price / old) * 100) : 0
  const cat = product.categories?.[0]?.name

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="pcard" data-testid="product-wrapper">
      <div className="ph">
        {product.thumbnail && (
          <Image src={product.thumbnail} alt={productAlt(product)} fill sizes="(max-width: 700px) 50vw, (max-width: 1024px) 33vw, 25vw" />
        )}
        {pct > 0 ? <span className="tag red"><bdi dir="ltr">-{pct}%</bdi></span> : tag ? <span className="tag">{tag}</span> : null}
        <WishButton productId={product.id} />
      </div>
      <div className="pb">
        {cat && <div className="cat">{cat}</div>}
        <div className="nm" data-testid="product-title">{product.title}</div>
        <div className="meta">
          {storeConfig.features.reviews && meta.rating && <span className="st"><Icon name="star" size={12} /> {meta.rating}</span>}
          {storeConfig.features.reviews && meta.reviews && <span>({meta.reviews})</span>}
          {meta.sold_week >= 15 && <span className="ms-auto flex items-center gap-1"><Icon name="fire" size={12} /> اشترتها {meta.sold_week} هذا الأسبوع</span>}
        </div>
        <div className="pr">
          <span className="price" data-testid="price">{convertToLocale({ amount: price, currency_code: cur })}</span>
          {old && old > price && (
            <>
              <span className="old">{convertToLocale({ amount: old, currency_code: cur })}</span>
              <span className="save">{g("وفّري", "وفّر")} {convertToLocale({ amount: old - price, currency_code: cur })}</span>
            </>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  )
}
