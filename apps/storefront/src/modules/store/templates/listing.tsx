import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import ListingControls from "@modules/store/components/listing-controls"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { Suspense } from "react"
import PaginatedProducts from "./paginated-products"
import { langPrefix } from "@/i18n/config"
import { getLocale } from "next-intl/server"
import { getT } from "@/i18n/t"

/**
 * H11: قالب القوائم الموحّد (المتجر + الأقسام) بتصميم المتجر بدل قالب Medusa الإنجليزي:
 * المسار، العنوان، البحث (H9)، شرائح الأقسام، الترتيب بالعربية، والمنتجات.
 */
type Props = {
  countryCode: string
  sortBy?: SortOptions
  page?: string
  q?: string
  title: string
  subtitle?: string | null
  categoryId?: string
  activeHandle?: string
  crumbs?: { name: string; href: string }[]
}

export default async function ListingTemplate({ countryCode, sortBy, page, q, title, subtitle, categoryId, activeHandle, crumbs = [] }: Props) {
  const lang = await getLocale()
  const t = await getT("store")
  const sort = sortBy || "created_at"
  const categories = (await listCategories().catch(() => [])).filter((c: any) => !c.parent_category_id)
  const heading = q ? t("searchResults", { q }) : title
  return (
    <div className="wrap listing" data-testid="category-container">
      <nav className="crumbs" aria-label={t("s1e22a1")}>
        <LocalizedClientLink href="/">{t("s3aa857")}</LocalizedClientLink>
        <span aria-hidden>/</span>
        <LocalizedClientLink href="/store">{t("se18fb6")}</LocalizedClientLink>
        {crumbs.map((c) => (
          <span key={c.href} className="crumbs-item"><span aria-hidden>/</span> <LocalizedClientLink href={c.href}>{c.name}</LocalizedClientLink></span>
        ))}
      </nav>
      <div className="sechead">
        <div>
          <h1 data-testid={categoryId ? "category-page-title" : "store-page-title"}>{heading}</h1>
          {subtitle && !q && <p>{subtitle}</p>}
        </div>
      </div>
      <ListingControls searchAction={`/${countryCode}${langPrefix(lang)}/store`} />
      <div className="catchips" role="navigation" aria-label={t("sc6386f")}>
        <LocalizedClientLink href="/store" className={`catchip${!activeHandle && !q ? " on" : ""}`}>{t("s6d08f1")}</LocalizedClientLink>
        {categories.map((c: any) => (
          <LocalizedClientLink key={c.id} href={`/categories/${c.handle}`} className={`catchip${activeHandle === c.handle ? " on" : ""}`}>{c.name}</LocalizedClientLink>
        ))}
      </div>
      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts sortBy={sort} q={q} page={page ? parseInt(page) : 1} categoryId={categoryId} countryCode={countryCode} />
      </Suspense>
    </div>
  )
}
