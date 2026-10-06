import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * منخفضة: الطلب «سُلِّم» حين تصل كل قطعه — لا مع أول تسليم جزئي.
 * كل سطر: الكمية المسلَّمة ≥ الكمية (items.detail.delivered_quantity من Medusa).
 */
export async function isFullyDelivered(container: MedusaContainer, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.quantity", "items.detail.delivered_quantity"],
    filters: { id: orderId },
  })
  const items = ((data[0] as any)?.items ?? []) as any[]
  return items.length > 0 && items.every((i) => Number(i.detail?.delivered_quantity ?? 0) >= Number(i.quantity))
}
