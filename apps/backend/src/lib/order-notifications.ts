import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { orderNumber, storeData } from "./store-data"

/**
 * إشعارات واتساب لمراحل الطلب. كل نوع يقابل قالباً معتمداً (Utility) في Meta،
 * ومتغيراته بالترتيب في params — نفس الترتيب يجب أن يكون في نص القالب عند اعتماده.
 */
export type OrderNotice = "order_placed" | "order_shipped" | "order_ready_pickup" | "order_delivered"

type Built = { params: string[]; preview: string }

const money = (n: number, cur: string) =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)} ${cur === "omr" ? "ر.ع" : cur.toUpperCase()}`

/** نص كل قالب ومتغيراته — يُستخدم للمعاينة في السجل ولتوثيق القوالب المطلوب اعتمادها */
function build(kind: OrderNotice, o: { name: string; number: string; total: string; shipping: string; track: string }): Built {
  const s = storeData()
  switch (kind) {
    case "order_placed":
      return {
        params: [o.name, o.number, o.total, o.track],
        preview: `مرحباً ${o.name}، تم استلام طلبك ${o.number} من ${s.name} بقيمة ${o.total}. نبدأ بتجهيزه الآن، وتتبّعيه من هنا: ${o.track}`,
      }
    case "order_shipped":
      return {
        params: [o.name, o.number, o.track],
        preview: `${o.name}، طلبك ${o.number} خرج للتوصيل مع مندوب ${s.name} وسيتصل بك قبل الوصول. التتبّع: ${o.track}`,
      }
    case "order_ready_pickup":
      return {
        params: [o.name, o.number, s.location?.name ?? s.name],
        preview: `${o.name}، طلبك ${o.number} جاهز للاستلام من ${s.location?.name ?? s.name}. نسعد بزيارتك.`,
      }
    case "order_delivered":
      return {
        params: [o.name, o.number],
        // «تسليم» تشمل التوصيل والاستلام من المشغل
        preview: `تم تسليم طلبك ${o.number} يا ${o.name}. نتمنى أن تسعدك القطعة — شكراً لثقتك في ${s.name}.`,
      }
  }
}

/**
 * يرسل إشعار مرحلة الطلب إلى هاتف التوصيل. idempotencyKey يمنع التكرار إن أُعيد الحدث.
 * الأخطاء تُسجَّل ولا تُرمى حتى لا يتأثر سير الطلب بفشل الإرسال.
 */
export async function notifyOrder(container: MedusaContainer, orderId: string, kind: OrderNotice, idempotencyKey: string) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "total", "currency_code", "shipping_address.phone", "shipping_address.first_name", "shipping_methods.name"],
      filters: { id: orderId },
    })
    const order: any = data[0]
    const phone = String(order?.shipping_address?.phone ?? "").replace(/\D/g, "")
    if (!order || phone.length < 8) return

    const number = orderNumber(order.display_id)
    const s = storeData()
    const base = process.env.STOREFRONT_URL || "http://localhost:8000"
    const built = build(kind, {
      name: order.shipping_address?.first_name || "عزيزتنا",
      number,
      total: money(Number(order.total), order.currency_code ?? s.currency),
      shipping: order.shipping_methods?.[0]?.name ?? "",
      // رابط التتبّع بلا الهاتف: الزبونة تُدخله بنفسها (لا بيانات شخصية في الروابط)
      track: `${base}/${s.country}/track?no=${number}`,
    })

    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: phone.startsWith("968") ? `+${phone}` : `+968${phone.slice(-8)}`,
      channel: "whatsapp",
      template: kind,
      data: { params: built.params, preview: built.preview },
      trigger_type: kind,
      resource_id: orderId,
      resource_type: "order",
      idempotency_key: `${kind}:${idempotencyKey}`,
    })
  } catch (e) {
    logger.warn(`whatsapp ${kind} للطلب ${orderId}: ${(e as Error).message}`)
  }
}

/** معرّف الطلب ونوع التوصيل من معرّف التنفيذ (أحداث الشحن والتوصيل تحمل fulfillment id) */
export async function orderOfFulfillment(container: MedusaContainer, fulfillmentId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order_fulfillment",
    fields: ["order_id", "fulfillment_id"],
    filters: { fulfillment_id: fulfillmentId },
  })
  const orderId = (data[0] as any)?.order_id as string | undefined
  if (!orderId) return null
  const { data: orders } = await query.graph({ entity: "order", fields: ["id", "metadata"], filters: { id: orderId } })
  return { orderId, shippingCode: ((orders[0] as any)?.metadata?.shipping_code ?? null) as string | null }
}
