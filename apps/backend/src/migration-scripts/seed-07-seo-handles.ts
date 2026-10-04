/** يسجّل الرابط الحالي لكل منتج وقسم (seo_last_handle) حتى يُنشأ تحويل 301 من أول تغيير بعد النشر */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { syncHandle } from "../lib/seo-handles"

export default async function seo_handles({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({ entity: "product", fields: ["id"] })
  const { data: categories } = await query.graph({ entity: "product_category", fields: ["id"] })
  for (const p of products) await syncHandle(container, "product", p.id)
  for (const c of categories) await syncHandle(container, "category", c.id)
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`seo-handles: ${products.length} منتجاً و${categories.length} قسماً`)
}
