import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * منخفضة: الطلب «سُلِّم» حين تصل كل قطعه — لا مع أول تسليم جزئي.
 * كل سطر: الكمية المسلَّمة ≥ الكمية (items.detail.delivered_quantity من Medusa).
 */
export async function isFullyDelivered(container: MedusaContainer, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.quantity", "items.detail.quantity", "items.detail.delivered_quantity"],
    filters: { id: orderId },
  })
  const items = ((data[0] as any)?.items ?? []) as any[]
  // items.quantity يعود BigNumber (Number() ← NaN فكانت المقارنة خاطئة دائماً) — الكمية من detail أو القيمة الرقمية
  const num = (v: any) => Number(v?.numeric ?? v?.value ?? v)
  return items.length > 0 && items.every((i) => num(i.detail?.delivered_quantity ?? 0) >= num(i.detail?.quantity ?? i.quantity))
}
