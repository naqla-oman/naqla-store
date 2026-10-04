import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TRACKING_MODULE } from "../../../modules/tracking"
import type TrackingModuleService from "../../../modules/tracking/service"

/** GET /store/tracking-config — المعرّفات العامة فقط لتحميل البكسلات في المتصفح (بلا أي رمز سري) */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ config: await req.scope.resolve<TrackingModuleService>(TRACKING_MODULE).publicConfig() })
}
