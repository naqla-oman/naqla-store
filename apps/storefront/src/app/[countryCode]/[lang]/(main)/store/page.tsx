import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"
import { storeConfig } from "@/store.config"
import { langPrefix } from "@/i18n/config"
import { getT } from "@/i18n/t"

/** منخفضة: عنوان ووصف عربيان؛ نتائج البحث (?q=) لا تُفهرس ورابطها القانوني /store */
export async function generateMetadata(props: Params): Promise<Metadata> {
  const t = await getT("store")
  const { countryCode, lang } = await props.params
  const { q, page } = await props.searchParams
  return {
    title: q ? t("searchResults", { q: q.slice(0, 60) }) : t("s2495fa"),
    description: storeConfig.description,
    alternates: { canonical: `/${countryCode}${langPrefix(lang)}/store${!q && page && page !== "1" ? `?page=${page}` : ""}` },
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
