import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { client } from "../lib/client"

/**
 * منخفضة: حجز مخزون طلبات واتساب (بانتظار التأكيد) والاستلام من المحل كان بلا انتهاء.
 * كل ساعة: طلب غير منفَّذ وغير محصَّل تجاوز مدته في store.json → reservationHours يُلغى
 * (يُفك الحجز، وتصل الزبونة رسالة الإلغاء من M14). null يعطّل النوع.
 */
export async function expireReservations(container: MedusaContainer, now = new Date()) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const hours = ((client() as any).reservationHours ?? {}) as { whatsapp?: number | null; pickup?: number | null }
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const rows = (await pg.raw(`
    select o.id, o.display_id, o.created_at, o.metadata->>'payment_channel' as pay, o.metadata->>'shipping_code' as ship
      from "order" o
     where o.deleted_at is null and o.status = 'pending' and o.is_draft_order = false
       and (o.metadata->>'payment_channel' = 'whatsapp' or o.metadata->>'shipping_code' = 'pickup')
       and not exists (select 1 from order_fulfillment ofl join fulfillment f on f.id = ofl.fulfillment_id
                        where ofl.order_id = o.id and ofl.deleted_at is null and f.canceled_at is null)
       and not exists (select 1 from order_payment_collection opc join payment p on p.payment_collection_id = opc.payment_collection_id
                        where opc.order_id = o.id and p.captured_at is not null)`)).rows as any[]
  const expired = rows.filter((o) => {
    const h = o.pay === "whatsapp" ? hours.whatsapp : hours.pickup
    return h != null && now.getTime() - new Date(o.created_at).getTime() > Number(h) * 3600_000
  })
  for (const o of expired) {
    try {
      await cancelOrderWorkflow(container).run({ input: { order_id: o.id } as any })
      logger.info(`[reservations] أُلغي الطلب ${o.display_id} (${o.pay === "whatsapp" ? "واتساب بلا تأكيد" : "استلام لم يتم"}) وفُك حجز مخزونه`)
    } catch (e) {
      logger.warn(`[reservations] ${o.display_id}: ${(e as Error).message}`)
    }
  }
  return { checked: rows.length, canceled: expired.length }
}

export default async function expireReservationsJob(container: MedusaContainer) {
  await expireReservations(container)
}

export const config = { name: "expire-reservations", schedule: "17 * * * *" }
