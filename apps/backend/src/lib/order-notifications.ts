import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { langOfLocale, orderNumber, storeData, storeNames } from "./store-data"
import { decimalsOf, round } from "./money"
import { whatsappEnabled } from "./credentials"

/**
 * إشعارات واتساب لمراحل الطلب. كل نوع يقابل قالباً معتمداً (Utility) في Meta،
 * ومتغيراته بالترتيب في params — نفس الترتيب يجب أن يكون في نص القالب عند اعتماده.
 * المرحلة 4 (لغات): اللغة من order.locale (en-US ← الإنجليزية)؛ القالب الإنجليزي من WHATSAPP_TPL_*_EN،
 * وإن لم يُعتمد بعد تُرسل النسخة العربية. تنبيه التاجر (merchant_new_order) عربي دائماً.
 */
export type OrderNotice = "order_placed" | "order_shipped" | "order_ready_pickup" | "order_delivered" | "order_canceled" | "merchant_new_order" | "order_shipped_courier"
export type Lang = "ar" | "en"

type Built = { params: string[]; preview: string }
type Vars = { name: string; number: string; total: string; shipping: string; track: string; payment?: string; awb?: string; awbUrl?: string }

// منخفضة: منازل العملة (الريال 3، والريال السعودي/الدرهم 2…) لا 3 لكل العملات؛ التسمية حسب اللغة (ر.ع / OMR)
export const money = (n: number, cur: string, lang: Lang = "ar") => {
  const d = decimalsOf(cur)
  const label = lang === "ar" && cur === "omr" ? "ر.ع" : cur.toUpperCase()
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(round(n, cur))} ${label}`
}

/** اسم المخاطَبة حين لا اسم في العنوان: «مرحباً بك» / «Hello there» — لا اسم افتراضي مؤنث */
export const greetingName = (first?: string | null, lang: Lang = "ar") => (first && first.trim()) || (lang === "en" ? "there" : "بك")

/** هل القالب الإنجليزي لهذا النوع معتمد (اسمه في البيئة)؟ */
export const englishTemplateName = (kind: OrderNotice) => process.env[`WHATSAPP_TPL_${kind.toUpperCase()}_EN`] || undefined

/** نص كل قالب ومتغيراته — يُستخدم للمعاينة في السجل ولتوثيق القوالب المطلوب اعتمادها */
export function build(kind: OrderNotice, o: Vars, lang: Lang = "ar"): Built {
  // النصوص مطابقة حرفياً لقوالب Meta في clients/<slug>/whatsapp-templates{,.en}.md:
  // لا يبدأ المتن ولا ينتهي بمتغير (شرط Meta)، والمتغيرات بترتيب ظهورها {{1}}، {{2}}…
  const { name: store, place } = storeNames(lang)
  if (lang === "en") {
    switch (kind) {
      case "order_placed":
        return { params: [o.name, o.number, o.total, o.track], preview: `Hello ${o.name}, we received your order ${o.number} for ${o.total}. We are preparing it now, and you can track it here: ${o.track} — thank you for shopping at ${store}.` }
      case "order_shipped":
        return { params: [o.name, o.number, o.track], preview: `Hello ${o.name}, your order ${o.number} is out for delivery and the courier will call you before arriving. Tracking: ${o.track} — ${store}.` }
      case "order_ready_pickup":
        return { params: [o.name, o.number, place], preview: `Hello ${o.name}, your order ${o.number} is ready for pickup from ${place}. We look forward to seeing you — ${store}.` }
      case "order_delivered":
        return { params: [o.name, o.number], preview: `Hello ${o.name}, your order ${o.number} has been delivered. We hope you love it — thank you for trusting ${store}.` }
      case "order_shipped_courier":
        return { params: [o.name, o.number, o.awb ?? "", o.awbUrl || o.track], preview: `Hello ${o.name}, your order ${o.number} has been shipped with the courier, waybill ${o.awb ?? ""}. Tracking: ${o.awbUrl || o.track} — ${store}.` }
      case "order_canceled":
        return { params: [o.name, o.number], preview: `Hello ${o.name}, your order ${o.number} has been canceled. If you paid online, the amount is refunded within 7 business days; for any question just message us — ${store}.` }
      case "merchant_new_order":
        break // تنبيه التاجر عربي دائماً
    }
  }
  const s = storeData()
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
 * يرسل إشعار مرحلة الطلب إلى هاتف التوصيل بلغة الطلب. idempotencyKey يمنع التكرار إن أُعيد الحدث.
 * الأخطاء تُسجَّل ولا تُرمى حتى لا يتأثر سير الطلب بفشل الإرسال.
 */
export async function notifyOrder(container: MedusaContainer, orderId: string, kind: OrderNotice, idempotencyKey: string, extra: { awb?: string; awbUrl?: string } = {}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "total", "currency_code", "locale", "shipping_address.phone", "shipping_address.first_name", "shipping_methods.name"],
      filters: { id: orderId },
    })
    const order: any = data[0]
    const phone = String(order?.shipping_address?.phone ?? "").replace(/\D/g, "")
    if (!order || phone.length < 8) return

    // لغة الزبونة من الطلب؛ وإن لم يُعتمد القالب الإنجليزي بعد تُرسل العربية (لا تُحجب الرسالة).
    // التفعيل بالمنطق نفسه الذي تستعمله خدمة واتساب: .env أو مفاتيح «إعدادات المتجر»
    let lang: Lang = kind === "merchant_new_order" ? "ar" : langOfLocale(order.locale)
    if (lang === "en" && !englishTemplateName(kind) && whatsappEnabled()) {
      logger.info(`whatsapp ${kind}: لا قالب إنجليزي معتمد (WHATSAPP_TPL_${kind.toUpperCase()}_EN) — تُرسل العربية`)
      lang = "ar"
    }
    const number = orderNumber(order.display_id)
    const s = storeData()
    const base = process.env.STOREFRONT_URL || "http://localhost:8000"
    const built = build(kind, {
      name: greetingName(order.shipping_address?.first_name, lang),
      number,
      total: money(Number(order.total), order.currency_code ?? s.currency, lang),
      shipping: order.shipping_methods?.[0]?.name ?? "",
      // رابط التتبّع بلا الهاتف: الزبونة تُدخله بنفسها (لا بيانات شخصية في الروابط)؛ بالإنجليزية /en
      track: `${base}/${s.country}${lang === "en" ? "/en" : ""}/track?no=${number}`,
      ...extra,
    }, lang)

    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: phone.startsWith("968") ? `+${phone}` : `+968${phone.slice(-8)}`,
      channel: "whatsapp",
      template: kind,
      data: { params: built.params, preview: built.preview, lang },
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
