import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { findRedirect } from "@lib/data/seo"
import { breadcrumbs, jsonLdScript } from "@lib/seo/jsonld"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { langPrefix } from "@/i18n/config"
import { getT } from "@/i18n/t"
import { getStoreConfig } from "@/i18n/store-config"
import { langAlternates, ogLocale } from "@lib/seo/alternates"

type Props = {
  params: Promise<{ category: string[]; countryCode: string; lang: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
}

export async function generateStaticParams() {
  const product_categories = await listCategories()

  if (!product_categories) {
    return []
  }

  const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
  )

  const categoryHandles = product_categories.map(
    (category: any) => category.handle
  )

  const staticParams = countryCodes
    ?.map((countryCode: string | undefined) =>
      categoryHandles.map((handle: any) => ({
        countryCode,
        category: [handle],
      }))
    )
    .flat()

  return staticParams
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const sc = await getStoreConfig()
  const params = await props.params
  const category = await getCategoryByHandle(params.category).catch(() => null)
  if (!category) {
    const to = await findRedirect(`/categories/${params.category.join("/")}`)
    if (to) permanentRedirect(`/${params.countryCode}${langPrefix(params.lang)}${to}`)
    notFound()
  }
  const meta = (category.metadata ?? {}) as Record<string, any>
  const description = (meta.seo_description || category.description || `${category.name} — ${sc.name}`).slice(0, 160)
  return {
    // اسم المتجر يُضاف من قالب العنوان في التخطيط الجذري
    title: meta.seo_title || category.name,
    description,
    alternates: await langAlternates(params.countryCode, params.lang, `/categories/${params.category.join("/")}`),
    openGraph: { title: `${meta.seo_title || category.name} | ${sc.name}`, description, ...(await ogLocale(params.lang)) },
  }
}

export default async function CategoryPage(props: Props) {
  const t = await getT("store")
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams

  const productCategory = await getCategoryByHandle(params.category).catch(() => null)

  if (!productCategory) {
    const to = await findRedirect(`/categories/${params.category.join("/")}`)
    if (to) permanentRedirect(`/${params.countryCode}${langPrefix(params.lang)}${to}`)
    notFound()
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbs([
            { name: t("s3aa857"), path: `/${params.countryCode}${langPrefix(params.lang)}` },
            { name: productCategory.name, path: `/${params.countryCode}${langPrefix(params.lang)}/categories/${productCategory.handle}` },
          ])
        )}
      />
      <CategoryTemplate
        category={productCategory}
        sortBy={sortBy}
        page={page}
        countryCode={params.countryCode}
      />
    </>
  )
}
