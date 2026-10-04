/**
 * أسعار التوصيل شاملة الضريبة.
 * أسعار خيارات التوصيل مرتبطة بالمنطقة (region_id)، وتفضيل «شامل الضريبة» في البذرة
 * كان على العملة فقط، فكان Medusa يضيف 5٪ فوق رسوم التوصيل (1.500 → 1.575).
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createPricePreferencesWorkflow, updatePricePreferencesWorkflow } from "@medusajs/medusa/core-flows"

export default async function tax_inclusive_shipping({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pricing = container.resolve(Modules.PRICING)

  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "name"] })
  for (const region of regions) {
    const [existing] = await pricing.listPricePreferences({ attribute: "region_id", value: region.id })
    if (existing) {
      await updatePricePreferencesWorkflow(container).run({
        input: { selector: { id: existing.id }, update: { is_tax_inclusive: true } },
      })
    } else {
      await createPricePreferencesWorkflow(container).run({
        input: [{ attribute: "region_id", value: region.id, is_tax_inclusive: true }],
      })
    }
    logger.info(`tax-inclusive: أسعار منطقة «${region.name}» شاملة الضريبة`)
  }
}
