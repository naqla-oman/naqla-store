/** M1: إخفاء رموز الدخول المخزّنة سابقاً في جدول notification */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function redact_otp({ container }: { container: MedusaContainer }) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const r = await pg.raw(`update notification set data = jsonb_set(data, '{otp}', '"••••••"') where data ? 'otp' and data->>'otp' <> '••••••'`)
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`redact-otp: ${r.rowCount ?? 0} سجلاً`)
}
