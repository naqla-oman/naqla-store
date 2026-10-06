import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { orderOfFulfillment } from "../lib/order-notifications"
import { isFullyDelivered } from "../lib/delivery"

/**
 * M16: الدفع عند الاستلام يُحصَّل تلقائياً عند التسليم — المندوب استلم المبلغ.
 * كان الطلب يبقى «غير محصّل» في اللوحة والتقارير بعد التسليم. يُحصَّل المتبقي فقط (لا تحصيل مكرر).
 */
export default async function codCaptureOnDelivery({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const found = await orderOfFulfillment(container, data.id)
  if (!found) return
  // منخفضة: التحصيل حين يكتمل التسليم (المندوب يستلم المبلغ كاملاً مع آخر قطعة)
  if (!(await isFullyDelivered(container, found.orderId))) return
  const { data: rows } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "payment_collections.payments.id", "payment_collections.payments.provider_id", "payment_collections.payments.amount", "payment_collections.payments.captured_at", "payment_collections.payments.canceled_at", "payment_collections.payments.captures.amount"],
    filters: { id: found.orderId },
  })
  const payments = (((rows[0] as any)?.payment_collections ?? []) as any[]).flatMap((pc) => pc.payments ?? [])
  for (const p of payments) {
    if (p.provider_id !== "pp_cod_offline" || p.canceled_at) continue
    const captured = ((p.captures ?? []) as any[]).reduce((s, c) => s + Number(c.amount), 0)
    const remaining = Number(p.amount) - captured
    if (remaining <= 0.0005) continue
    try {
      await capturePaymentWorkflow(container).run({ input: { payment_id: p.id, amount: remaining } })
      logger.info(`[cod] الطلب ${(rows[0] as any).display_id}: حُصِّل ${remaining} عند التسليم`)
    } catch (e) {
      logger.warn(`[cod] تعذّر تحصيل ${p.id}: ${(e as Error).message}`)
    }
  }
}

export const config: SubscriberConfig = { event: "delivery.created" }
