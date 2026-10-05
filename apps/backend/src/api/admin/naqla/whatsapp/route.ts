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
]

export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client()
  const sample = { name: "هند", number: `${c.orderPrefix}0009`, total: `10.000 ${(c as any).currencyLabel ?? ""}`.trim(), shipping: "توصيل عادي", track: `https://<الدومين>/${c.country}/track?no=${c.orderPrefix}0009` }
  res.json({
    enabled: process.env.WHATSAPP_ENABLED === "true",
    credentials: { token: !!process.env.WHATSAPP_ACCESS_TOKEN, phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID },
    language: process.env.WHATSAPP_TEMPLATE_LANG || "ar",
    templates: [
      { key: "otp", title: "رمز الدخول", category: "Authentication", env: "WHATSAPP_OTP_TEMPLATE", name: process.env.WHATSAPP_OTP_TEMPLATE || null, preview: "نص تولّده Meta تلقائياً مع زر «نسخ الرمز»", params: [] },
      ...ORDER.map((o) => {
        const b = build(o.kind, sample)
        return { key: o.kind, title: o.title, category: "Utility", env: o.env, name: process.env[o.env] || null, preview: b.preview, params: b.params }
      }),
    ],
  })
}
