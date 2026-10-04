import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import SeoPanel from "../components/seo-panel"

const ProductSeoWidget = ({ data }: DetailWidgetProps<AdminProduct>) => (
  <SeoPanel kind="product" id={data.id} title={data.title} handle={data.handle} description={data.description} metadata={data.metadata} />
)

export const config = defineWidgetConfig({ zone: "product.details.after" })
export default ProductSeoWidget
