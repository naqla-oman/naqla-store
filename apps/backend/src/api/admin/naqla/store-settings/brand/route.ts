import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { processBrandImage } from "../../../../../lib/brand-images"
import { SettingsError } from "../../../../../lib/store-settings-schema"
import { STORE_SETTINGS_MODULE } from "../../../../../modules/store-settings"
import type StoreSettingsModuleService from "../../../../../modules/store-settings/service"
import { adminError } from "../../../../../lib/admin-i18n"

/** POST /admin/naqla/store-settings/brand  { kind: "logo" | "icon", data: "data:image/png;base64,…" } */
export const POST = async (req: AuthenticatedMedusaRequest<{ kind?: string; data?: string; background?: string }>, res: MedusaResponse) => {
  const kind = req.body?.kind
  if (kind !== "logo" && kind !== "icon") throw adminError(MedusaError.Types.INVALID_DATA, "image_kind")
  const bg = /^#[0-9a-f]{6}$/i.test(req.body?.background ?? "") ? req.body!.background! : "#ffffff"
  try {
    const patch = await processBrandImage(kind, req.body?.data ?? "", bg)
    const svc = req.scope.resolve<StoreSettingsModuleService>(STORE_SETTINGS_MODULE)
    const { changes } = await svc.saveOverrides(patch, { id: req.auth_context?.actor_id }, req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
    res.json({ ok: true, changes, urls: patch })
  } catch (e) {
    if (e instanceof SettingsError) throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
    throw e
  }
}
