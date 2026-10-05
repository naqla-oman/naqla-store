import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import ListingTemplate from "@modules/store/templates/listing"

/** صفحة القسم بقالب القوائم الموحّد (H11) — المسار يشمل الأقسام الأب */
export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) {
  if (!category || !countryCode) notFound()

  const trail: { name: string; href: string }[] = []
  let p: any = category.parent_category
  while (p) {
    trail.unshift({ name: p.name, href: `/categories/${p.handle}` })
    p = p.parent_category
  }

  return (
    <ListingTemplate
      countryCode={countryCode}
      sortBy={sortBy}
      page={page}
      title={category.name}
      subtitle={category.description}
      categoryId={category.id}
      activeHandle={category.handle}
      crumbs={[...trail, { name: category.name, href: `/categories/${category.handle}` }]}
    />
  )
}
