import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import Tailoring from "./index"
import { storeConfig } from "../../../../store.config"

/** يجلب منتج خدمة التفصيل بأسعاره ويعرض اللوحة إن كانت لقسم القطعة خدمة متاحة */
export default async function TailoringSlot({ product, region }: { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion }) {
  const T = storeConfig.tailoring
  const category = product.categories?.[0]?.handle ?? ""
  if (!T || !T.services.some((s) => s.categories.includes(category))) return null
  const { response } = await listProducts({
    regionId: region.id,
    queryParams: { handle: T.handle, fields: "*variants.calculated_price,+variants.metadata,+metadata" },
  }).catch(() => ({ response: { products: [] as HttpTypes.StoreProduct[] } }))
  const service = response.products[0]
  if (!service) return null
  return <Tailoring product={product} service={service} />
}
