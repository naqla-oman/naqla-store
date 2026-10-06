import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { storeConfig } from "../../../store.config"
import ListingTemplate from "./listing"
import { useT } from "@/i18n/t"

/** صفحة المتجر: كل المنتجات أو نتائج البحث (H11) */
const StoreTemplate = ({ sortBy, q, page, countryCode }: { sortBy?: SortOptions; q?: string; page?: string; countryCode: string }) => {
  const t = useT("store")
  return <ListingTemplate countryCode={countryCode} sortBy={sortBy} q={q} page={page} title={t("s2495fa")} subtitle={storeConfig.description} />
}

export default StoreTemplate
