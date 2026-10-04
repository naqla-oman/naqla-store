import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TRACKING_MODULE } from "../../../../modules/tracking"
import type TrackingModuleService from "../../../../modules/tracking/service"
import { PUBLIC_FIELDS, SECRET_FIELDS } from "../../../../modules/tracking/service"
import { updateTrackingSettingsWorkflow } from "../../../../workflows/update-tracking-settings"

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
    update[k] = s || null
  }
  if ("snap_test_mode" in req.body) update.snap_test_mode = req.body.snap_test_mode === true
  await updateTrackingSettingsWorkflow(req.scope).run({ input: { update } })
  res.json({ settings: await tracking.maskedSettings() })
}
