import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TRACKING_MODULE } from "../../../../../modules/tracking"
import type TrackingModuleService from "../../../../../modules/tracking/service"
import { SENDERS, type Platform } from "../../../../../lib/server-events"

/**
 * POST /admin/tracking/test/:platform — «إرسال حدث تجريبي».
 * يستخدم test_event_code (Meta/TikTok) أو وضع التحقق (Snap validate، GA4 debug) إن ضُبطت،
 * ويعيد استجابة المنصة كما هي ليرى المسؤول سبب أي رفض.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const platform = req.params.platform as Platform
  if (!(platform in SENDERS)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "منصة غير معروفة")
  const creds = await req.scope.resolve<TrackingModuleService>(TRACKING_MODULE).getSettings()
  const now = Date.now()
  const result = await SENDERS[platform](
    creds,
    {
      name: "test",
      event_id: `test_${now}`,
      url: process.env.STOREFRONT_URL || "http://localhost:8000",
      user: { ip: req.ip, ua: String(req.headers["user-agent"] ?? "naqla-test") },
    },
    { debug: true, test: true }
  ).catch((e) => ({ platform, ok: false, status: 0, response: String(e?.message ?? e) }))
  res.json({ result })
}
