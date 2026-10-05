/** H18: تعبئة custom_display_id (LN-0048) للطلبات القائمة حتى يُبحث بها في اللوحة */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { orderNumber } from "../lib/store-data"

export default async function custom_display_id({ container }: { container: MedusaContainer }) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order", fields: ["id", "display_id", "custom_display_id"], pagination: { take: 100000 },
  })
  const todo = (data as any[]).filter((o) => !o.custom_display_id)
  if (todo.length) await container.resolve(Modules.ORDER).updateOrders(todo.map((o) => ({ id: o.id, custom_display_id: orderNumber(o.display_id) }) as any))
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`custom-display-id: ${todo.length} طلباً`)
}
