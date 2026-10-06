import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { readShipping } from "../../../../lib/shipping-settings"

/**
 * M19: حد التوصيل المجاني من مصدر واحد — قاعدة السعر الفعلية في Medusa (سعر 0 عند item_total gte X)
 * لا من store.json: تغييره من اللوحة يظهر في الشريط والسلة وبيانات المنتج.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const r = await pg.raw(`
    select min((pr.value)::numeric) as free_over
      from shipping_option so
      join shipping_option_type sot on sot.id = so.shipping_option_type_id
      join shipping_option_price_set sops on sops.shipping_option_id = so.id
      join price p on p.price_set_id = sops.price_set_id and p.deleted_at is null and p.amount = 0
      join price_rule pr on pr.price_id = p.id and pr.deleted_at is null
     where so.deleted_at is null and sot.code = 'standard' and pr.attribute = 'item_total' and pr.operator in ('gte', 'gt')`)
  const v = (r.rows ?? r)[0]?.free_over
  // تبويب «التوصيل»: المحافظات المفعّلة من منطقة الخدمة (null = كلها) — قائمة المحافظات في الدفع تُصفّى بها
  const s = await readShipping(req.scope)
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ free_over: v == null ? null : Number(v), governorates: s.governorates, express_provinces: s.express?.provinces ?? null })
}
