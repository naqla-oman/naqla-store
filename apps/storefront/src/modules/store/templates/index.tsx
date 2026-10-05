import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { storeConfig } from "../../../store.config"
import ListingTemplate from "./listing"

/** صفحة المتجر: كل المنتجات أو نتائج البحث (H11) */
const StoreTemplate = ({ sortBy, q, page, countryCode }: { sortBy?: SortOptions; q?: string; page?: string; countryCode: string }) => (
  <ListingTemplate countryCode={countryCode} sortBy={sortBy} q={q} page={page} title="كل المنتجات" subtitle={storeConfig.description} />
)

export default StoreTemplate
