import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import ShareButton from "@modules/products/components/share-button"
import WishButton from "@modules/common/components/wish-button"
import { storeConfig } from "../../../../store.config"
import { useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

/** رأس المنتج: القسم، العنوان مع المشاركة، والتقييم */
export default function ProductInfo({ product }: { product: HttpTypes.StoreProduct }) {
  const sc = useStoreConfig()
  const t = useT("product")
  const meta = (product.metadata || {}) as Record<string, any>
  const rating = Number(meta.rating) || 0
  const reviews = Number(meta.reviews) || 0
  const category = product.categories?.[0]

  return (
    <div>
      {category && <div className="pcat">{category.name}</div>}
      <div className="titlerow">
        <h1 data-testid="product-title">{product.title}</h1>
        <WishButton productId={product.id} className="iconbtn share wishbtn" size={18} />
        <ShareButton title={product.title} />
      </div>
      {meta.title_en && <div className="latinline">{meta.title_en}</div>}
      {/* التقييمات خلف features.reviews: بيانات الديمو مزروعة، وتُطفأ لأي عميل حقيقي حتى نظام تقييمات فعلي */}
      {sc.features.reviews && rating > 0 && (
        <div className="raterow">
          <span className="stars" aria-label={t("ratingOf", { rating })}>
            {Array.from({ length: 5 }, (_, i) => (
              <Icon key={i} name="star" size={13} className={i < Math.round(rating) ? "fill-current" : "opacity-30"} />
            ))}
            <b className="num">{rating.toFixed(1)}</b>
          </span>
          {reviews > 0 && <span className="muted">({t("reviewsCount", { count: reviews })})</span>}
        </div>
      )}
    </div>
  )
}
