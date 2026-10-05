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
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule = container.resolve(Modules.ORDER)
  const target = digits(phone)
  if (target.length < 8) return [] as string[]

  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "customer.has_account", "shipping_address.phone", "metadata"],
    pagination: { take: 1000, order: { created_at: "DESC" } },
  })
  const ids = data
    .filter((o: any) => digits(o.shipping_address?.phone) === target)
    .filter((o: any) => o.customer_id !== customerId && !o.customer?.has_account)
    // M11: طلب الهدية هاتف توصيله للمستلِمة — لا يُنسب لها (ولا نقاطه) إن أنشأت حساباً
    .filter((o: any) => !o.metadata?.gift)
    .map((o: any) => o.id as string)

  if (ids.length) {
    await orderModule.updateOrders(ids.map((id) => ({ id, customer_id: customerId })))
    // الطلبات المنسوبة تكسب نقاطها أيضاً (معلّقة أو متاحة حسب حالة توصيلها)
    for (const order_id of ids) {
      await awardOrderPointsWorkflow(container).run({ input: { order_id } })
    }
  }
  return ids
}
