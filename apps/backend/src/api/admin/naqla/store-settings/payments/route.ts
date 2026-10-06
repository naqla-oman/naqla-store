import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { client } from "../../../../../lib/client"
import { SECRET_KEYS, credential } from "../../../../../lib/credentials"
import { syncPaymentProviders } from "../../../../../lib/payment-providers"
import { mask } from "../../../../../lib/secret-box"
import { SettingsError } from "../../../../../lib/store-settings-schema"
import { STORE_SETTINGS_MODULE } from "../../../../../modules/store-settings"
import type StoreSettingsModuleService from "../../../../../modules/store-settings/service"

/** GET — الأسرار مخفية (آخر 4 أحرف) مع مصدرها، وأرقام التاجر */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({
    secrets: Object.fromEntries(SECRET_KEYS.map((k) => {
      const c = credential(k)
      return [k, { value: k === "thawani.mode" ? c.value ?? "uat" : mask(c.value), source: c.source }]
    })),
    merchantPhones: (client() as any).merchantPhones ?? [],
  })
}

/** POST — { secrets: { "thawani.secretKey": "…" }, merchantPhones: ["968…"] } */
export const POST = async (req: AuthenticatedMedusaRequest<{ secrets?: Record<string, unknown>; merchantPhones?: unknown }>, res: MedusaResponse) => {
  const svc = req.scope.resolve<StoreSettingsModuleService>(STORE_SETTINGS_MODULE)
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const actor = { id: req.auth_context?.actor_id }
  try {
    const a = req.body?.secrets ? (await svc.saveSecrets(req.body.secrets, actor, pg)).changes : []
    const b = req.body?.merchantPhones !== undefined ? (await svc.saveOverrides({ merchantPhones: req.body.merchantPhones }, actor, pg)).changes : []
    // مفاتيح ثواني تغيّرت ← مزامنة مزوّدي الدفع للمنطقة فوراً (يظهر/يختفي ثواني في الدفع)
    if (a.some((c) => c.key.startsWith("thawani."))) await syncPaymentProviders(req.scope)
    res.json({ ok: true, changes: [...a, ...b] })
  } catch (e) {
    if (e instanceof SettingsError) throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
    throw e
  }
}
