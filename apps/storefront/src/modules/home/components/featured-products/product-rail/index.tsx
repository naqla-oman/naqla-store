import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import Icon from "@modules/common/components/icon"
import { getT } from "@/i18n/t"

type T = (k: string, v?: Record<string, string | number>) => string
const subOf = (t: T): Record<string, string> => ({
  new: t("s36a0ed"),
  bestsellers: t("s8bdd7a"),
  sale: t("s056650"),
})

export default async function ProductRail({ collection, region }: { collection: HttpTypes.StoreCollection; region: HttpTypes.StoreRegion }) {
  const t = await getT("store")
  const SUB = subOf(t)
  const { response: { products } } = await listProducts({
    regionId: region.id,
    queryParams: { collection_id: collection.id, fields: "*variants.calculated_price,+metadata,*categories,*collection", limit: 4 },
  })
  if (!products?.length) return null

  return (
    <section className="wrap">
      <div className="sechead">
        <div><h2>{collection.title}</h2><p>{SUB[collection.handle!] || ""}</p></div>
        <LocalizedClientLink href={`/collections/${collection.handle}`}>{t("s1eab5c")} <Icon name="chevL" size={14} /></LocalizedClientLink>
      </div>
      <div className="pgrid">
        {products.map((product) => <ProductPreview key={product.id} product={product} region={region} />)}
      </div>
    </section>
  )
}
