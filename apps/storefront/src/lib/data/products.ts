"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"
import { localeQuery } from "@/i18n/t"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,+options.metadata,+options.values.metadata,",
          ...(await localeQuery()),
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null
      // منتجات الخدمة (مثل «تفصيل خاص» — metadata.service) لا تظهر في القوائم، إلا عند طلبها بالاسم
      const visible = queryParams?.handle ? products : products.filter((p) => !(p.metadata as any)?.service)

      return {
        response: {
          products: visible,
          count: count - (products.length - visible.length),
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12
  const pageParam = (Math.max(page, 1) - 1) * limit

  // M22: «الأحدث» يُرتَّب ويُقسَّم في Medusa مباشرة (-created_at + limit/offset الحقيقيين) —
  // كان يجلب أول 100 تصاعدياً فتختفي أحدث المنتجات عند تجاوز 100
  if (sortBy === "created_at" && !(queryParams as any)?.id && !(queryParams as any)?.collection_id) {
    // منخفضة: المعرّفات من الخلفية بلا منتج الخدمة (صفحات كاملة وعدد صحيح)، ثم المنتجات بترتيبها
    const cat = Array.isArray((queryParams as any)?.category_id) ? (queryParams as any).category_id[0] : (queryParams as any)?.category_id
    const { ids, count } = await sdk.client.fetch<{ ids: string[]; count: number }>("/store/naqla/product-ids", {
      query: { limit, offset: pageParam, ...(cat ? { category_id: cat } : {}) },
      next: { tags: ["global:products"] },
      cache: "force-cache",
    })
    if (!ids.length) return { response: { products: [], count }, nextPage: null, queryParams }
    const { response } = await listProducts({ pageParam: 1, queryParams: { id: ids, limit: ids.length } as any, countryCode })
    const rank = new Map(ids.map((id, i) => [id, i]))
    const products = [...response.products].sort((x, y) => (rank.get(x.id) ?? 0) - (rank.get(y.id) ?? 0))
    return { response: { products, count }, nextPage: count > pageParam + limit ? pageParam + limit : null, queryParams }
  }
  if (sortBy === "created_at") {
    const { response } = await listProducts({
      pageParam: Math.max(page, 1),
      queryParams: { ...queryParams, limit, order: "-created_at" } as any,
      countryCode,
    })
    return {
      response,
      nextPage: response.count > pageParam + limit ? pageParam + limit : null,
      queryParams,
    }
  }

  // الترتيب بالسعر: Medusa لا يرتّب بالسعر المحسوب ← نجلب الكل على دفعات (حتى 1000) ثم نرتّب ونقسّم
  const all: HttpTypes.StoreProduct[] = []
  let count = 0
  for (let p = 1; p <= 10; p++) {
    const { response } = await listProducts({ pageParam: p, queryParams: { ...queryParams, limit: 100 }, countryCode })
    all.push(...response.products)
    count = response.count
    if (all.length >= count || !response.products.length) break
  }

  const sortedProducts = sortProducts(all, sortBy)

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}
