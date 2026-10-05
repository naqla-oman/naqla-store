import { MedusaError } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { normalizeAr } from "../../lib/arabic-search"
import { client } from "../../lib/client"

/**
 * M18: الولاية من قائمة ولايات المحافظة (store.json) — لا نص حر يكسر التوصيل والتقارير.
 * المقارنة بعد تطبيع الإملاء (إزكي = ازكي). المحافظة بلا قائمة تُقبل كما هي.
 */
updateCartWorkflow.hooks.validate(async ({ input }) => {
  const a = (input as any).shipping_address
  if (!a?.province || !a?.city) return
  if (String(a.country_code ?? "om").toLowerCase() !== "om") return
  const gov = (client() as any).checkout?.governorates?.find((g: any) => g.code === String(a.province).toLowerCase())
  if (!gov) throw new MedusaError(MedusaError.Types.INVALID_DATA, "المحافظة غير معروفة")
  const list: string[] = gov.wilayats ?? []
  if (!list.length) return
  const city = normalizeAr(String(a.city))
  if (!list.some((w) => normalizeAr(w) === city)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `الولاية «${a.city}» لا تتبع محافظة ${gov.name}`)
  }
})
