import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { adminLang, clientIn } from "../../../../../lib/admin-i18n"
import { client } from "../../../../../lib/client"
import { queueRevalidate } from "../../../../../lib/revalidate"
import { readShipping, writeShipping, type ShippingInput } from "../../../../../lib/shipping-settings"
import { SettingsError } from "../../../../../lib/store-settings-schema"
import { STORE_SETTINGS_MODULE } from "../../../../../modules/store-settings"
import type StoreSettingsModuleService from "../../../../../modules/store-settings/service"

/** GET — إعدادات التوصيل من Medusa (+ وقت الإغلاق وأيام العطل من إعدادات المتجر) */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client() as any, names = clientIn(adminLang(req)) as any
  res.json({ ...(await readShipping(req.scope)), all: (names.checkout?.governorates ?? []).map((x: any) => ({ code: x.code, name: x.name })), pickupProvince: c.location?.province ?? null })
}

/** POST — { standard, express, governorates, cutoffHour, deliveryOffDays } */
export const POST = async (req: AuthenticatedMedusaRequest<ShippingInput & { cutoffHour?: number; deliveryOffDays?: number[] }>, res: MedusaResponse) => {
  const svc = req.scope.resolve<StoreSettingsModuleService>(STORE_SETTINGS_MODULE)
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const actor = { id: req.auth_context?.actor_id }
  try {
    const { cutoffHour, deliveryOffDays, ...medusa } = req.body ?? {}
    const changes = await writeShipping(req.scope, medusa)
    const values: Record<string, unknown> = {}
    if (cutoffHour !== undefined) values.cutoffHour = cutoffHour
    if (deliveryOffDays !== undefined) values.deliveryOffDays = deliveryOffDays
    const own = Object.keys(values).length ? (await svc.saveOverrides(values, actor, pg)).changes : []
    await svc.recordChanges(changes, actor)
    queueRevalidate(["shipping-threshold", "store-settings"])
    res.json({ ok: true, changes: [...changes, ...own] })
  } catch (e) {
    if (e instanceof SettingsError) throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
    throw e
  }
}
