import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminLang, clientIn } from "../../../../lib/admin-i18n"
import { client } from "../../../../lib/client"

/**
 * GET /admin/naqla/labels — منخفضة: أسماء المحافظات وطرق التوصيل من store.json للعميل
 * (كانت خرائط عُمانية ثابتة في admin/lib/oman.ts فتختلف عن إعداد العميل). المرحلة 5: بلغة اللوحة (x-naqla-lang).
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = clientIn(adminLang(req)) as any, base = client() as any
  // الولاية تُحفظ في العنوان بنصها العربي (قرار 22) ← تسميتها بلغة اللوحة
  const wilayats: Record<string, string> = {}
  for (const g of base.checkout?.governorates ?? []) {
    const l = c.checkout?.governorates?.find((x: any) => x.code === g.code)
    ;(g.wilayats ?? []).forEach((w: string, i: number) => { wilayats[w] = l?.wilayats?.[i] ?? w })
  }
  res.json({
    wilayats,
    governorates: Object.fromEntries((c.checkout?.governorates ?? []).map((g: any) => [g.code, g.name])),
    shipping: Object.fromEntries((c.shipping ?? []).map((s: any) => [s.code, s.name])),
  })
}
