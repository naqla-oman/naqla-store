import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"
import { PRODUCT_FIELDS } from "@modules/products/lib/fields"

/** يجلب الأسعار والمخزون الحالية ثم يعرض أدوات الشراء */
export default async function ProductActionsWrapper({ id, region }: { id: string; region: HttpTypes.StoreRegion }) {
  const product = await listProducts({
    queryParams: { id: [id], fields: PRODUCT_FIELDS },
    regionId: region.id,
  }).then(({ response }) => response.products[0])

  if (!product) return null

  return <ProductActions product={product} region={region} />
}
