import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { orderNumber } from "../lib/store-data"

/** H18: رقم الطلب الذي تعرفه الزبونة (LN-0048) في custom_display_id — حقل قابل للبحث في لوحة Medusa */
export default async function setCustomDisplayId({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const { data: rows } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order", fields: ["id", "display_id", "custom_display_id"], filters: { id: data.id },
  })
  const o: any = rows[0]
  if (!o || o.custom_display_id) return
  // الحقل موجود في نموذج الطلب (searchable) لكن UpdateOrderDTO لا يصرّح به في 2.21
  await container.resolve(Modules.ORDER).updateOrders([{ id: o.id, custom_display_id: orderNumber(o.display_id) } as any])
}

export const config: SubscriberConfig = { event: "order.placed" }
