import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { TRACKING_MODULE } from "../modules/tracking"
import type TrackingModuleService from "../modules/tracking/service"

type Kind = "product" | "category"
const BASE: Record<Kind, string> = { product: "/products/", category: "/categories/" }

/**
 * تحويل 301 من أي تعديل للرابط (من widget السيو أو نموذج Medusa نفسه):
 * metadata.seo_last_handle = آخر رابط معروف؛ إن اختلف عن الحالي يُنشأ التحويل ويُحدَّث.
 * التحديث يطلق الحدث مرة ثانية لكنه يتوقف لأن القيمتين صارتا متساويتين.
 */
export async function syncHandle(container: MedusaContainer, kind: Kind, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: kind === "product" ? "product" : "product_category", fields: ["id", "handle", "metadata"], filters: { id } })
  const row: any = data[0]
  if (!row?.handle) return
  const last = row.metadata?.seo_last_handle as string | undefined
  if (last === row.handle) return
  if (last) {
    await container.resolve<TrackingModuleService>(TRACKING_MODULE).addRedirect({
      from_path: BASE[kind] + last,
      to_path: BASE[kind] + row.handle,
      entity: kind,
      entity_id: id,
    })
    container.resolve(ContainerRegistrationKeys.LOGGER).info(`[seo] 301 ${BASE[kind]}${last} → ${BASE[kind]}${row.handle}`)
  }
  const metadata = { ...(row.metadata ?? {}), seo_last_handle: row.handle }
  if (kind === "product") await updateProductsWorkflow(container).run({ input: { selector: { id }, update: { metadata } } })
  else await updateProductCategoriesWorkflow(container).run({ input: { selector: { id }, update: { metadata } } })
}
