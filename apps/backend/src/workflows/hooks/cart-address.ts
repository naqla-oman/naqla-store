import { MedusaError } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { normalizeAr } from "../../lib/arabic-search"
import { client } from "../../lib/client"
import { readShipping } from "../../lib/shipping-settings"

/**
 * M18: الولاية من قائمة ولايات المحافظة (store.json) — لا نص حر يكسر التوصيل والتقارير.
 * المقارنة بعد تطبيع الإملاء (إزكي = ازكي). المحافظة بلا قائمة تُقبل كما هي.
 */
updateCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const a = (input as any).shipping_address
  if (!a?.province || !a?.city) return
  if (String(a.country_code ?? "om").toLowerCase() !== "om") return
  const gov = (client() as any).checkout?.governorates?.find((g: any) => g.code === String(a.province).toLowerCase())
  if (!gov) throw new MedusaError(MedusaError.Types.INVALID_DATA, "المحافظة غير معروفة")
  // تبويب «التوصيل»: المحافظات المفعّلة من منطقة الخدمة في Medusa
  const enabled = (await readShipping(container)).governorates
  if (enabled && !enabled.includes(gov.code)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `التوصيل غير متاح حالياً إلى محافظة ${gov.name}`)
  const list: string[] = gov.wilayats ?? []
  if (!list.length) return
  const city = normalizeAr(String(a.city))
  if (!list.some((w) => normalizeAr(w) === city)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `الولاية «${a.city}» لا تتبع محافظة ${gov.name}`)
  }
})

/**
 * A3: الاسم القياسي للولاية يُحفظ (لا «ازكي» بل «إزكي») — middleware قبل حفظ عنوان السلة.
 * يعدّل الجسم والجسم المُتحقَّق معاً، فيعمل أياً كان ترتيب تحقق Medusa.
 */
export function canonicalWilayat(province?: string, city?: string): string | null {
  if (!province || !city) return null
  const gov = (client() as any).checkout?.governorates?.find((g: any) => g.code === String(province).toLowerCase())
  const target = normalizeAr(String(city))
  return (gov?.wilayats ?? []).find((w: string) => normalizeAr(w) === target) ?? null
}

export function canonicalizeAddress(req: any, _res: any, next: () => void) {
  for (const body of [req.body, req.validatedBody]) {
    const a = body?.shipping_address
    const name = canonicalWilayat(a?.province, a?.city)
    if (name) a.city = name
  }
  next()
}
