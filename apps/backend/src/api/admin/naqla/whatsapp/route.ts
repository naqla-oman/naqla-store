import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "../../../../lib/client"
import { whatsappCreds, whatsappEnabled } from "../../../../lib/credentials"
import { build, type OrderNotice } from "../../../../lib/order-notifications"

/**
 * GET /admin/naqla/whatsapp — قوالب واتساب: النص بمتغيراته، واسم القالب المعتمد في Meta (من .env)، وحالة الإرسال.
 * الأسرار (رمز الوصول) لا تُعرض؛ يظهر فقط هل هي مضبوطة (من اللوحة أو .env).
 * المرحلة 5: عنوان كل قالب ووصف قالب الدخول من ترجمات اللوحة بالمفتاح (key)؛ المعاينة العربية محتوى عربي أصلاً.
 */
const ORDER: { kind: OrderNotice; env: string }[] = [
  { kind: "order_placed", env: "WHATSAPP_TPL_ORDER_PLACED" },
  { kind: "order_shipped", env: "WHATSAPP_TPL_ORDER_SHIPPED" },
  { kind: "order_ready_pickup", env: "WHATSAPP_TPL_ORDER_READY_PICKUP" },
  { kind: "order_delivered", env: "WHATSAPP_TPL_ORDER_DELIVERED" },
  { kind: "order_shipped_courier", env: "WHATSAPP_TPL_ORDER_SHIPPED_COURIER" },
  { kind: "order_canceled", env: "WHATSAPP_TPL_ORDER_CANCELED" },
  { kind: "merchant_new_order", env: "WHATSAPP_TPL_MERCHANT_NEW_ORDER" },
]

export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client(), creds = whatsappCreds()
  const sample = { name: "هند", number: `${c.orderPrefix}0009`, total: `10.000 ${(c as any).currencyLabel ?? ""}`.trim(), shipping: "توصيل عادي", track: `https://<الدومين>/${c.country}/track?no=${c.orderPrefix}0009`, payment: "عند الاستلام", awb: "ARX123456", awbUrl: "https://<شركة الشحن>/track/ARX123456" }
  res.json({
    enabled: whatsappEnabled(),
    credentials: { token: !!creds.accessToken, phoneNumberId: !!creds.phoneNumberId },
    language: process.env.WHATSAPP_TEMPLATE_LANG || "ar",
    languageEn: process.env.WHATSAPP_TEMPLATE_LANG_EN || "en",
    templates: [
      { key: "otp", category: "Authentication", env: "WHATSAPP_OTP_TEMPLATE", name: process.env.WHATSAPP_OTP_TEMPLATE || null, preview: null, params: [] },
      ...ORDER.map((o) => {
        const b = build(o.kind, sample)
        // المرحلة 4: النسخة الإنجليزية (تُعتمد في Meta بلغة en) — للطلبات بلغة en-US؛ تنبيه التاجر عربي فقط
        const en = o.kind === "merchant_new_order" ? null : build(o.kind, { ...sample, name: "Hind", total: "10.000 OMR", shipping: "Standard delivery", payment: "Cash on delivery", track: `https://<domain>/${c.country}/en/track?no=${c.orderPrefix}0009`, awbUrl: "https://<courier>/track/ARX123456" }, "en")
        return { key: o.kind, category: "Utility", env: o.env, name: process.env[o.env] || null, preview: b.preview, params: b.params, ...(en ? { en: { env: `${o.env}_EN`, name: process.env[`${o.env}_EN`] || null, preview: en.preview, params: en.params } } : {}) }
      }),
    ],
  })
}
