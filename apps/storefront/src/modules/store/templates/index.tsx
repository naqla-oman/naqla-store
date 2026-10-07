import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { storeConfig } from "../../../store.config"
import ListingTemplate from "./listing"
import { useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

/** صفحة المتجر: كل المنتجات أو نتائج البحث (H11) */
const StoreTemplate = ({ sortBy, q, page, countryCode }: { sortBy?: SortOptions; q?: string; page?: string; countryCode: string }) => {
  const sc = useStoreConfig()
  const t = useT("store")
  return <ListingTemplate countryCode={countryCode} sortBy={sortBy} q={q} page={page} title={t("s2495fa")} subtitle={sc.description} />
}

export default StoreTemplate
