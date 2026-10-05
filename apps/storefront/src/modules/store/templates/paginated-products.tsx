import { ListEvent } from "@modules/common/components/track-events"
import { listProductsWithSort } from "@lib/data/products"
import { searchProducts } from "@lib/data/search"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  q,
  listName,
  categoryId,
  productsIds,
  countryCode,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  q?: string
  listName?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  // H10: البحث العربي المُطبَّع (عباية = عباءة، الألوان والأقسام) بدل q الحرفي في Medusa
  let relevance: string[] | null = null
  if (q?.trim()) {
    const found = await searchProducts(q.trim())
    if (!found.ids.length) {
      return (
        <div className="empty-search" data-testid="search-empty">
          <ListEvent listName="search" items={[]} searchTerm={q.trim()} />
          <p className="es-title">لم نجد نتائج لـ «{q.trim()}»</p>
          <p className="es-hint">جرّب كلمة أقصر أو تصفّح الأقسام:</p>
          <div className="catchips">
            {found.categories.map((c) => (
              <LocalizedClientLink key={c.handle} href={`/categories/${c.handle}`} className="catchip">{c.name}</LocalizedClientLink>
            ))}
          </div>
        </div>
      )
    }
    relevance = found.ids
    queryParams["id"] = found.ids
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  let {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
  })

  // نتائج البحث بترتيب الصلة ما لم يختر الزائر ترتيباً بالسعر
  if (relevance && sortBy === "created_at") {
    const rank = new Map(relevance.map((id, i) => [id, i]))
    products = [...products].sort((x, y) => (rank.get(x.id) ?? 1e9) - (rank.get(y.id) ?? 1e9))
  }

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  const trackItems = products.map((p) => ({
    id: p.id,
    name: p.title,
    price: p.variants?.[0]?.calculated_price?.calculated_amount ?? undefined,
    category: p.categories?.[0]?.name ?? undefined,
  }))

  return (
    <>
      <ListEvent listName={listName ?? (q ? "search" : categoryId ? "category" : collectionId ? "collection" : "store")} items={trackItems} searchTerm={q?.trim() || undefined} />
      <ul
        className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
        data-testid="products-list"
      >
        {products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview product={p} region={region} />
            </li>
          )
        })}
      </ul>
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
