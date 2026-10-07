import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { client, clientDefaults } from "../../../../lib/client"
import { HISTORY_TOKENS, adminLang, clientIn } from "../../../../lib/admin-i18n"
import { SCHEMA, SettingsError, getPath } from "../../../../lib/store-settings-schema"
import { STORE_SETTINGS_MODULE } from "../../../../modules/store-settings"
import type StoreSettingsModuleService from "../../../../modules/store-settings/service"
import { syncPaymentProviders } from "../../../../lib/payment-providers"
import { themePresets } from "../../../../lib/themes"
import { adminError } from "../../../../lib/admin-i18n"

/**
 * GET /admin/naqla/store-settings — القيم الفعلية والافتراضية للمفاتيح القابلة للتعديل + سجل التغييرات.
 * المرحلة 5: أسماء المحافظات والولايات بلغة اللوحة (القيمة المخزَّنة للولاية تبقى عربية — wilayatLabels بالترتيب نفسه)،
 * وقيم السجل الثابتة رموز «~…» تترجمها اللوحة.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc = req.scope.resolve<StoreSettingsModuleService>(STORE_SETTINGS_MODULE)
  const eff = client(), def = clientDefaults(), names = clientIn(adminLang(req)) as any
  const token = (v: unknown) => (typeof v === "string" && HISTORY_TOKENS[v]) || v
  const keys = Object.keys(SCHEMA)
  res.json({
    values: Object.fromEntries(keys.map((k) => [k, getPath(eff, k) ?? null])),
    defaults: Object.fromEntries(keys.map((k) => [k, getPath(def, k) ?? null])),
    tabs: Object.fromEntries(keys.map((k) => [k, SCHEMA[k].tab])),
    presets: themePresets(),
    governorates: ((eff as any).checkout?.governorates ?? []).map((x: any) => {
      const l = names.checkout?.governorates?.find((g: any) => g.code === x.code)
      return { code: x.code, name: l?.name ?? x.name, wilayats: x.wilayats, wilayatLabels: l?.wilayats ?? x.wilayats }
    }),
    history: (await svc.history(20)).map((h: any) => ({ at: h.created_at, by: h.actor_email ?? h.actor_id, changes: (h.changes?.items ?? []).map((c: any) => ({ ...c, from: token(c.from), to: token(c.to) })) })),
  })
}

/** POST /admin/naqla/store-settings  { values: { "features.loyalty": true, ... } } */
export const POST = async (req: AuthenticatedMedusaRequest<{ values?: Record<string, unknown> }>, res: MedusaResponse) => {
  const values = req.body?.values
  if (!values || typeof values !== "object" || Array.isArray(values)) throw adminError(MedusaError.Types.INVALID_DATA, "values_required")
  const svc = req.scope.resolve<StoreSettingsModuleService>(STORE_SETTINGS_MODULE)
  let email: string | null = null
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "user", fields: ["email"], filters: { id: req.auth_context?.actor_id } })
    email = (data[0] as any)?.email ?? null
  } catch { /* السجل يكتفي بالمعرّف */ }
  try {
    const { changes } = await svc.saveOverrides(values, { id: req.auth_context?.actor_id, email }, req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
    // الميزات: تغيّر طرق الدفع ← مزامنة مزوّدي الدفع للمنطقة فوراً (M12)
    if (changes.some((c) => /^features\.(cod|thawani|whatsappOrder)$/.test(c.key))) await syncPaymentProviders(req.scope)
    res.json({ ok: true, changes })
  } catch (e) {
    if (e instanceof SettingsError) throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
    throw e
  }
}
