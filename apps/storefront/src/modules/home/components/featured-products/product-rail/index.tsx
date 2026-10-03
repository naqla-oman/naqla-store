import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import Icon from "@modules/common/components/icon"

const SUB: Record<string, string> = {
  new: "آخر ما أضفناه هذا الأسبوع",
  bestsellers: "اختيارات زبوناتنا المفضلة",
  sale: "خصومات محدودة على قطع مختارة",
}

export default async function ProductRail({ collection, region }: { collection: HttpTypes.StoreCollection; region: HttpTypes.StoreRegion }) {
  const { response: { products } } = await listProducts({
    regionId: region.id,
    queryParams: { collection_id: collection.id, fields: "*variants.calculated_price,+metadata,*categories,*collection", limit: 4 },
  })
  if (!products?.length) return null

  return (
    <section className="wrap">
      <div className="sechead">
        <div><h2>{collection.title}</h2><p>{SUB[collection.handle!] || ""}</p></div>
        <LocalizedClientLink href={`/collections/${collection.handle}`}>عرض الكل <Icon name="chevL" size={14} /></LocalizedClientLink>
      </div>
      <div className="pgrid">
        {products.map((product) => <ProductPreview key={product.id} product={product} region={region} />)}
      </div>
    </section>
  )
}
