import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { stampOptionKeys } from "../lib/option-keys"

/** المرحلة 2: مفاتيح ثابتة للخيارات (metadata.key) وألوان القيم (metadata.hex) — بدل المطابقة بالنص العربي */
export default async function seedOptionKeys({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const r = await stampOptionKeys(container)
  logger.info(`seed-13: مفاتيح الخيارات — ${r.options} خياراً، ${r.values} قيمة لون`)
}
