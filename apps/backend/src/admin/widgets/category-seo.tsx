import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProductCategory, DetailWidgetProps } from "@medusajs/framework/types"
import SeoPanel from "../components/seo-panel"

const CategorySeoWidget = ({ data }: DetailWidgetProps<AdminProductCategory>) => (
  <SeoPanel kind="category" id={data.id} title={data.name} handle={data.handle} description={data.description} metadata={data.metadata} />
)

export const config = defineWidgetConfig({ zone: "product_category.details.after" })
export default CategorySeoWidget
