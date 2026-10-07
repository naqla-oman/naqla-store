import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "../../../../lib/client"
import { build, type OrderNotice } from "../../../../lib/order-notifications"

/**
 * GET /admin/naqla/whatsapp — قوالب واتساب: النص بمتغيراته، واسم القالب المعتمد في Meta (من .env)، وحالة الإرسال.
 * الأسرار (رمز الوصول) لا تُعرض؛ يظهر فقط هل هي مضبوطة.
 */
const ORDER: { kind: OrderNotice; env: string; title: string }[] = [
  { kind: "order_placed", env: "WHATSAPP_TPL_ORDER_PLACED", title: "تم استلام الطلب" },
  { kind: "order_shipped", env: "WHATSAPP_TPL_ORDER_SHIPPED", title: "خرج للتوصيل" },
  { kind: "order_ready_pickup", env: "WHATSAPP_TPL_ORDER_READY_PICKUP", title: "جاهز للاستلام" },
  { kind: "order_delivered", env: "WHATSAPP_TPL_ORDER_DELIVERED", title: "تم التسليم" },
  { kind: "order_shipped_courier", env: "WHATSAPP_TPL_ORDER_SHIPPED_COURIER", title: "شُحن مع شركة (رقم البوليصة)" },
  { kind: "order_canceled", env: "WHATSAPP_TPL_ORDER_CANCELED", title: "إلغاء الطلب (للزبونة)" },
  { kind: "merchant_new_order", env: "WHATSAPP_TPL_MERCHANT_NEW_ORDER", title: "طلب جديد (للتاجر — merchantPhones)" },
]

export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client()
  const sample = { name: "هند", number: `${c.orderPrefix}0009`, total: `10.000 ${(c as any).currencyLabel ?? ""}`.trim(), shipping: "توصيل عادي", track: `https://<الدومين>/${c.country}/track?no=${c.orderPrefix}0009`, payment: "عند الاستلام", awb: "ARX123456", awbUrl: "https://<شركة الشحن>/track/ARX123456" }
  res.json({
    enabled: process.env.WHATSAPP_ENABLED === "true",
    credentials: { token: !!process.env.WHATSAPP_ACCESS_TOKEN, phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID },
    language: process.env.WHATSAPP_TEMPLATE_LANG || "ar",
    templates: [
      { key: "otp", title: "رمز الدخول", category: "Authentication", env: "WHATSAPP_OTP_TEMPLATE", name: process.env.WHATSAPP_OTP_TEMPLATE || null, preview: "نص تولّده Meta تلقائياً مع زر «نسخ الرمز»", params: [] },
      ...ORDER.map((o) => {
        const b = build(o.kind, sample)
        // المرحلة 4: النسخة الإنجليزية (تُعتمد في Meta بلغة en) — للطلبات بلغة en-US؛ تنبيه التاجر عربي فقط
        const en = o.kind === "merchant_new_order" ? null : build(o.kind, { ...sample, name: "Hind", total: "10.000 OMR", shipping: "Standard delivery", payment: "Cash on delivery", track: `https://<domain>/${c.country}/en/track?no=${c.orderPrefix}0009` }, "en")
        return { key: o.kind, title: o.title, category: "Utility", env: o.env, name: process.env[o.env] || null, preview: b.preview, params: b.params, ...(en ? { en: { env: `${o.env}_EN`, name: process.env[`${o.env}_EN`] || null, preview: en.preview, params: en.params } } : {}) }
      }),
    ],
  })
}
