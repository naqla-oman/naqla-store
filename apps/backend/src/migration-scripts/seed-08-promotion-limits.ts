/** H4: حد الاستخدام الكلي لأكواد store.json على القواعد القائمة (الشروط الأخرى تُفحص وقت التطبيق والإتمام) */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updatePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { client } from "../lib/client"

export default async function promotion_limits({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const promos = container.resolve(Modules.PROMOTION)
  for (const p of client().promotions ?? []) {
    if (!p.limit) continue
    const [row] = await promos.listPromotions({ code: p.code }, { take: 1 })
    if (!row) continue
    await updatePromotionsWorkflow(container).run({ input: { promotionsData: [{ id: row.id, limit: p.limit } as any] } })
    logger.info(`promotion-limits: ${p.code} → ${p.limit}`)
  }
}
