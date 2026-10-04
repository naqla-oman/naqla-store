import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TRACKING_MODULE } from "../../../modules/tracking"
import type TrackingModuleService from "../../../modules/tracking/service"

/** GET /store/seo-redirect?path=/products/old — وجهة التحويل 301 إن وُجدت */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const path = String(req.query.path ?? "")
  const [r] = path ? await req.scope.resolve<TrackingModuleService>(TRACKING_MODULE).listSeoRedirects({ from_path: path }) : []
  if (!r) throw new MedusaError(MedusaError.Types.NOT_FOUND, "لا يوجد تحويل")
  res.json({ to: r.to_path })
}
