import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../modules/loyalty/service"
import { storeError } from "../../../../lib/store-errors"

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
    fields: ["id", "display_id", "metadata", "item_total", "customer.has_account"],
    filters: { id: req.params.id },
  })
  const order = data[0]
  if (!order) {
    throw storeError(MedusaError.Types.NOT_FOUND, "order_not_found")
  }
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const extras = Object.fromEntries(PUBLIC_KEYS.filter((k) => k in meta).map((k) => [k, meta[k]]))
  // نقاط الولاء: الحالة الفعلية إن كان للطلب قيد، وإلا التقدير (لتشجيع الضيفة على إنشاء حساب)
  const loyalty = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const [entry] = await loyalty.listLoyaltyEntries({ order_id: order.id, kind: "earn" })
  const points = {
    points: entry?.points ?? (await loyalty.pointsFor((order as any).item_total ?? 0)),
    status: entry?.status ?? null,
    has_account: !!(order as any).customer?.has_account,
  }
  res.json({ id: order.id, display_id: order.display_id, extras, points })
}
