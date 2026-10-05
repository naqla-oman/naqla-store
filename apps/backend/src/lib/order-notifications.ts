import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { orderNumber, storeData } from "./store-data"

/**
 * إشعارات واتساب لمراحل الطلب. كل نوع يقابل قالباً معتمداً (Utility) في Meta،
 * ومتغيراته بالترتيب في params — نفس الترتيب يجب أن يكون في نص القالب عند اعتماده.
 */
export type OrderNotice = "order_placed" | "order_shipped" | "order_ready_pickup" | "order_delivered" | "order_canceled" | "merchant_new_order" | "order_shipped_courier"

type Built = { params: string[]; preview: string }

const money = (n: number, cur: string) =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)} ${cur === "omr" ? "ر.ع" : cur.toUpperCase()}`

/** نص كل قالب ومتغيراته — يُستخدم للمعاينة في السجل ولتوثيق القوالب المطلوب اعتمادها */
export function build(kind: OrderNotice, o: { name: string; number: string; total: string; shipping: string; track: string; payment?: string; awb?: string; awbUrl?: string }): Built {
  // النصوص مطابقة حرفياً لقوالب Meta في docs/whatsapp-templates.md:
  // لا يبدأ المتن ولا ينتهي بمتغير (شرط Meta)، والمتغيرات بترتيب ظهورها {{1}}، {{2}}…
  const s = storeData()
  const place = s.location?.name ?? s.name
  switch (kind) {
    case "order_placed":
      return {
        params: [o.name, o.number, o.total, o.track],
        preview: `مرحباً ${o.name}، تم استلام طلبك ${o.number} بقيمة ${o.total}. نبدأ بتجهيزه الآن، ويمكنك تتبّعه من الرابط: ${o.track} — شكراً لتسوقك من ${s.name}.`,
      }
    case "order_shipped":
      return {
        params: [o.name, o.number, o.track],
        preview: `مرحباً ${o.name}، طلبك ${o.number} خرج للتوصيل وسيتصل بك المندوب قبل الوصول. التتبّع: ${o.track} — ${s.name}.`,
      }
    case "order_ready_pickup":
      return {
        params: [o.name, o.number, place],
        preview: `مرحباً ${o.name}، طلبك ${o.number} جاهز للاستلام من ${place}. نسعد بزيارتك — ${s.name}.`,
      }
    case "order_delivered":
      return {
        params: [o.name, o.number],
        // «تسليم» تشمل التوصيل والاستلام من المشغل
        preview: `مرحباً ${o.name}، تم تسليم طلبك ${o.number}. نتمنى أن تسعدك القطعة — شكراً لثقتك في ${s.name}.`,
      }
    case "order_shipped_courier":
      // M20: شحنة عبر شركة — رقم البوليصة ورابط تتبّع الشركة
      return {
        params: [o.name, o.number, o.awb ?? "", o.awbUrl || o.track],
        preview: `مرحباً ${o.name}، طلبك ${o.number} شُحن مع شركة الشحن برقم البوليصة ${o.awb ?? ""}. التتبّع: ${o.awbUrl || o.track} — ${s.name}.`,
      }
    case "order_canceled":
      // M14: إشعار الإلغاء للزبونة
      return {
        params: [o.name, o.number],
        preview: `مرحباً ${o.name}، أُلغي طلبك ${o.number}. إن كان الدفع إلكترونياً يُعاد المبلغ خلال 7 أيام عمل، ولأي استفسار راسلنا — ${s.name}.`,
      }
    case "merchant_new_order":
      // M14: تنبيه التاجر بطلب جديد (لرقمه الشخصي في merchantPhones)
      return {
        params: [o.number, o.name, o.total, o.payment ?? ""],
        preview: `طلب جديد ${o.number} من ${o.name} بقيمة ${o.total} — الدفع: ${o.payment ?? ""}. افتح لوحة نقلة لتجهيزه — ${s.name}.`,
      }
  }
}

/**
 * يرسل إشعار مرحلة الطلب إلى هاتف التوصيل. idempotencyKey يمنع التكرار إن أُعيد الحدث.
 * الأخطاء تُسجَّل ولا تُرمى حتى لا يتأثر سير الطلب بفشل الإرسال.
 */
export async function notifyOrder(container: MedusaContainer, orderId: string, kind: OrderNotice, idempotencyKey: string, extra: { awb?: string; awbUrl?: string } = {}) {
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
      ...extra,
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
  // M20: بوليصة الشحنة إن أدخلها التاجر عند الشحن
  const { data: ful } = await query.graph({ entity: "fulfillment", fields: ["labels.tracking_number", "labels.tracking_url"], filters: { id: fulfillmentId } })
  const label = (((ful[0] as any)?.labels ?? []) as any[]).filter((l) => l?.tracking_number).pop()
  return {
    orderId,
    shippingCode: ((orders[0] as any)?.metadata?.shipping_code ?? null) as string | null,
    awb: (label?.tracking_number ?? null) as string | null,
    awbUrl: (/^https?:\/\//.test(label?.tracking_url ?? "") ? label.tracking_url : null) as string | null,
  }
}
