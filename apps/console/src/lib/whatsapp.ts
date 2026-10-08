import type { Log } from "./provisioner/types"

/**
 * رسالة «متجرك جاهز» للعميل (قالب store_ready): رابط اللوحة ورابط تعيين كلمة المرور.
 * الإنتاج: WhatsApp Cloud API برقم نقلة (CONSOLE_WHATSAPP_TOKEN/PHONE_ID)؛ التطوير: تُكتب في السجل.
 */
export async function sendStoreReady(p: { phone: string; name: string; panel: string; reset: string }, log: Log) {
  const to = String(p.phone).replace(/\D/g, "")
  const token = process.env.CONSOLE_WHATSAPP_TOKEN, phoneId = process.env.CONSOLE_WHATSAPP_PHONE_ID
  if (!token || !phoneId) {
    // الإنتاج بلا رقم نقلة بعد: لا يُهدم متجر جاهز من أجل رسالة — الرابط لا يُحفظ في أي سجل، ويُولَّد في طرفية الخادم
    if (process.env.NODE_ENV === "production") {
      const slug = /^https:\/\/api-([a-z0-9-]+)\./.exec(p.panel)?.[1] ?? /^https:\/\/api\.(.+?)\//.exec(p.panel)?.[1] ?? "<slug>"
      log(`⚠ واتساب نقلة غير مضبوط (CONSOLE_WHATSAPP_TOKEN) — لم تُرسل الرسالة. لوحة العميل: ${p.panel} — رابط تعيين كلمة المرور على الخادم: deploy/naqla.sh reset-link ${slug}`)
      return
    }
    // التطوير: الرابط الكامل في مخرجات المنفّذ فقط؛ وسجل الخطوة (في القاعدة) يحمل نسخة مخفية الرمز
    console.log(`[whatsapp:dev] store_ready → +${to} | ${p.panel} | ${p.reset}`)
    log(`[whatsapp:dev] store_ready → +${to} | متجرك «${p.name}» جاهز. لوحتك: ${p.panel} — عيّن كلمة المرور: ${p.reset.replace(/token=[^&]+/, "token=••••")}`)
    return
  }
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: process.env.CONSOLE_WHATSAPP_TPL_STORE_READY || "store_ready", language: { code: "ar" },
      components: [{ type: "body", parameters: [p.name, p.panel, p.reset].map((text) => ({ type: "text", text })) }] } }),
  })
  if (!r.ok) throw new Error(`واتساب: ${r.status} ${(await r.text()).slice(0, 200)}`)
  log(`أُرسلت رسالة store_ready إلى +${to}`)
}
