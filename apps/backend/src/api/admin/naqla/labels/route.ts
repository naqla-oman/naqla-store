import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "../../../../lib/client"

/**
 * GET /admin/naqla/labels — منخفضة: أسماء المحافظات وطرق التوصيل من store.json للعميل
 * (كانت خرائط عُمانية ثابتة في admin/lib/oman.ts فتختلف عن إعداد العميل).
 */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client() as any
  res.json({
    governorates: Object.fromEntries((c.checkout?.governorates ?? []).map((g: any) => [g.code, g.name])),
    shipping: Object.fromEntries((c.shipping ?? []).map((s: any) => [s.code, s.name])),
  })
}
