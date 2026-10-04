import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "../product-preview"

/** «قد يعجبك أيضاً»: من نفس القسم */
export default async function RelatedProducts({ product, region }: { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion }) {
  const categoryId = product.categories?.[0]?.id
  if (!categoryId) return null

  const { response } = await listProducts({
    regionId: region.id,
    queryParams: { category_id: [categoryId], fields: "*variants.calculated_price,+metadata,*categories,*collection", limit: 5 },
  })
  const products = response.products.filter((p) => p.id !== product.id).slice(0, 4)
  if (!products.length) return null

  return (
    <section>
      <div className="sechead"><div><h2>قد يعجبك أيضاً</h2><p>من {product.categories?.[0]?.name}</p></div></div>
      <div className="pgrid">
        {products.map((p) => <ProductPreview key={p.id} product={p} region={region} />)}
      </div>
    </section>
  )
}
