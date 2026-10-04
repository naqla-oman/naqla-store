import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/** حقول metadata المسموح عرضها للزبونة في صفحة النجاح فقط */
const PUBLIC_KEYS = ["gift", "gift_message", "courier_note", "payment_channel", "shipping_code"] as const

/**
 * GET /store/order-extras/:id
 * Store API لا يعيد metadata الطلب للضيف، فنعيد منها الحقول العامة أعلاه فقط.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { id: req.params.id },
  })
  const order = data[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "الطلب غير موجود")
  }
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const extras = Object.fromEntries(PUBLIC_KEYS.filter((k) => k in meta).map((k) => [k, meta[k]]))
  res.json({ id: order.id, display_id: order.display_id, extras })
}
