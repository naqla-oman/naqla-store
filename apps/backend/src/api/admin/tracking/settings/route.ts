import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TRACKING_MODULE } from "../../../../modules/tracking"
import type TrackingModuleService from "../../../../modules/tracking/service"
import { PUBLIC_FIELDS, SECRET_FIELDS } from "../../../../modules/tracking/service"
import { updateTrackingSettingsWorkflow } from "../../../../workflows/update-tracking-settings"

const SECRET_RE = { re: /^[A-Za-z0-9_\-.|=+/:]{16,800}$/, hint: "رمز وصول بلا مسافات" }
const FORMATS: Record<string, { re: RegExp; hint: string }> = {
  ga4_measurement_id: { re: /^G-[A-Z0-9]{6,12}$/, hint: "مثل G-AB12CD34EF" },
  meta_pixel_id: { re: /^\d{10,20}$/, hint: "أرقام فقط (10–20)" },
  snap_pixel_id: { re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, hint: "معرّف UUID من Snap" },
  tiktok_pixel_id: { re: /^[A-Z0-9]{15,25}$/i, hint: "حروف وأرقام (15–25)" },
  clarity_project_id: { re: /^[a-z0-9]{8,12}$/i, hint: "حروف وأرقام (8–12)" },
  ga4_api_secret: SECRET_RE,
  meta_access_token: SECRET_RE,
  snap_access_token: SECRET_RE,
  tiktok_access_token: SECRET_RE,
  meta_test_event_code: { re: /^TEST\d{3,10}$/i, hint: "مثل TEST12345" },
  tiktok_test_event_code: { re: /^TEST\d{3,10}$/i, hint: "مثل TEST12345" },
}
const TEXT_FIELDS = [...PUBLIC_FIELDS, ...SECRET_FIELDS, "meta_test_event_code", "tiktok_test_event_code"] as const

/** GET /admin/tracking/settings — الإعدادات مع إخفاء الرموز السرية */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ settings: await req.scope.resolve<TrackingModuleService>(TRACKING_MODULE).maskedSettings() })
}

/**
 * POST /admin/tracking/settings — تحديث الحقول المرسلة فقط.
 * الرمز السري: غير المرسل أو المُخفى («••••») يبقى كما هو، والنص الفارغ يحذفه.
 */
export const POST = async (req: AuthenticatedMedusaRequest<Record<string, unknown>>, res: MedusaResponse) => {
  const tracking = req.scope.resolve<TrackingModuleService>(TRACKING_MODULE)
  const update: Record<string, unknown> = {}
  for (const k of TEXT_FIELDS) {
    if (!(k in req.body)) continue
    const v = req.body[k]
    if (v !== null && typeof v !== "string") throw new MedusaError(MedusaError.Types.INVALID_DATA, `${k}: قيمة نصية مطلوبة`)
    const s = (v ?? "").trim()
    if ((SECRET_FIELDS as readonly string[]).includes(k) && s.startsWith("••••")) continue
    // منخفضة: صيغة كل معرّف حسب منصته (كان يقبل «<script>» معرّفاً)
    const rule = FORMATS[k]
    if (s && rule && !rule.re.test(s)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${k}: صيغة غير صحيحة — ${rule.hint}`)
    update[k] = s || null
  }
  if ("snap_test_mode" in req.body) update.snap_test_mode = req.body.snap_test_mode === true
  // M6: وقت حفظ رمز الاختبار يبدأ نافذة الـ24 ساعة (تغيير الرمز يعيدها، وحذفه يلغيها)
  const current = (await tracking.getSettings()) as any
  for (const k of ["meta_test_event_code", "tiktok_test_event_code"] as const) {
    if (!(k in update)) continue
    if (!update[k]) update[`${k}_at`] = null
    else if (update[k] !== current[k] || !current[`${k}_at`]) update[`${k}_at`] = new Date()
  }
  await updateTrackingSettingsWorkflow(req.scope).run({ input: { update } })
  res.json({ settings: await tracking.maskedSettings() })
}
