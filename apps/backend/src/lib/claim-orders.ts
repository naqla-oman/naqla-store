import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { awardOrderPointsWorkflow } from "../workflows/loyalty"

const digits = (p?: string | null) => String(p ?? "").replace(/\D/g, "")

/**
 * ينسب طلبات الضيف (بلا حساب) إلى الزبونة إن طابق هاتف التوصيل رقمها الموثَّق برمز واتساب.
 * يعيد معرّفات الطلبات المنسوبة.
 * ملاحظة: يقرأ آخر 1000 طلب — كافٍ لحجم البوتيك؛ عند النمو يُستبدل بفهرس على الهاتف.
 */
export async function claimOrdersByPhone(container: MedusaContainer, customerId: string, phone: string) {
  const orderModule = container.resolve(Modules.ORDER)
  const target = digits(phone)
  if (target.length < 8) return [] as string[]

  // منخفضة: بحث مباشر في القاعدة بآخر 8 أرقام من هاتف التوصيل — كان يفحص آخر 1000 طلب فقط
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const last8 = target.slice(-8)
  if (!/^\d{8}$/.test(last8)) return [] as string[]
  const rows = (await pg.raw(
    `select o.id from "order" o
       join order_address a on a.id = o.shipping_address_id
       left join customer c on c.id = o.customer_id
      where o.deleted_at is null
        and right(regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g'), 8) = ?
        and (o.customer_id is null or (o.customer_id <> ? and coalesce(c.has_account, false) = false))
        and coalesce(o.metadata->>'gift', 'false') <> 'true'`,
    [last8, customerId]
  )).rows as { id: string }[]
  const ids = rows.map((r) => r.id)
  if (ids.length) {
    await orderModule.updateOrders(ids.map((id) => ({ id, customer_id: customerId })))
    // الطلبات المنسوبة تكسب نقاطها أيضاً (معلّقة أو متاحة حسب حالة توصيلها)
    for (const order_id of ids) {
      await awardOrderPointsWorkflow(container).run({ input: { order_id } })
    }
  }
  return ids
}
