import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"
import { langPrefix } from "@/i18n/config"
import { getT } from "@/i18n/t"
import { getStoreConfig } from "@/i18n/store-config"
import { langAlternates, ogLocale } from "@lib/seo/alternates"

/** منخفضة: عنوان ووصف عربيان؛ نتائج البحث (?q=) لا تُفهرس ورابطها القانوني /store */
export async function generateMetadata(props: Params): Promise<Metadata> {
  const sc = await getStoreConfig()
  const t = await getT("store")
  const { countryCode, lang } = await props.params
  const { q, page } = await props.searchParams
  return {
    title: q ? t("searchResults", { q: q.slice(0, 60) }) : t("s2495fa"),
    description: sc.description,
    alternates: await langAlternates(countryCode, lang, `/store${!q && page && page !== "1" ? `?page=${page}` : ""}`),
    openGraph: { ...(await ogLocale(lang)) },
    ...(q ? { robots: { index: false, follow: true } } : {}),
  }
}

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    q?: string
    page?: string
  }>
  params: Promise<{
    countryCode: string
    lang: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page, q } = searchParams

  return (
    <StoreTemplate
      sortBy={sortBy}
      q={q}
      page={page}
      countryCode={params.countryCode}
    />
  )
}
