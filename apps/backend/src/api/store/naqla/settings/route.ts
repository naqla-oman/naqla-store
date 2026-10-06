import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORE_SETTINGS_MODULE } from "../../../../modules/store-settings"
import type StoreSettingsModuleService from "../../../../modules/store-settings/service"

/** GET /store/naqla/settings — تعديلات اللوحة العامة للواجهة (بلا أسرار؛ الأسرار في عمود منفصل لا يُرسل) */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const row: any = await req.scope.resolve<StoreSettingsModuleService>(STORE_SETTINGS_MODULE).getRow()
  res.json({ overrides: row.overrides ?? {} })
}
