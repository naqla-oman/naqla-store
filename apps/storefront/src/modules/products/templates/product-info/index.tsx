import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import ShareButton from "@modules/products/components/share-button"
import WishButton from "@modules/common/components/wish-button"

/** رأس المنتج: القسم، العنوان مع المشاركة، والتقييم */
export default function ProductInfo({ product }: { product: HttpTypes.StoreProduct }) {
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
      {rating > 0 && (
        <div className="raterow">
          <span className="stars" aria-label={`التقييم ${rating} من 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Icon key={i} name="star" size={13} className={i < Math.round(rating) ? "fill-current" : "opacity-30"} />
            ))}
            <b className="num">{rating.toFixed(1)}</b>
          </span>
          {reviews > 0 && <span className="muted">({reviews} تقييماً)</span>}
        </div>
      )}
    </div>
  )
}
