"use server"

import { HttpTypes } from "@medusajs/types"
import { listProducts } from "./products"
import { getRegion } from "./regions"
import { PRODUCT_FIELDS } from "@modules/products/lib/fields"

/** العرض السريع: المنتج بحقول صفحة المنتج نفسها (الخيارات والمخزون والأسعار بلغة الصفحة) ومنطقته */
export async function getQuickProduct(
  countryCode: string,
  handle: string
): Promise<{ product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion } | null> {
  const region = await getRegion(countryCode)
  if (!region) return null
  const product = await listProducts({
    countryCode,
    queryParams: { handle, fields: PRODUCT_FIELDS },
  }).then(({ response }) => response.products[0])
  if (!product || (product.metadata as any)?.service) return null
  return { product, region }
}
