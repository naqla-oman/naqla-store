import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { thawaniCreds, whatsappCreds } from "../../../../../../../lib/credentials"

/**
 * POST /admin/naqla/store-settings/payments/test/thawani|whatsapp — يختبر المفاتيح الفعلية دون أي أثر:
 * ثواني: قراءة جلسة غير موجودة (401 = مفتاح خاطئ، غيره = المفتاح مقبول). واتساب: بيانات الرقم من Meta.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const p = req.params.platform
  const timeout = AbortSignal.timeout(15000)
  if (p === "thawani") {
    const c = thawaniCreds()
    if (!c.secretKey || !c.publishableKey) return res.json({ ok: false, message: "مفاتيح ثواني غير مضبوطة" })
    const base = c.mode === "live" ? "https://checkout.thawani.om" : "https://uatcheckout.thawani.om"
    const r = await fetch(`${base}/api/v1/checkout/session/naqla_key_check`, { headers: { "thawani-api-key": c.secretKey }, signal: timeout }).catch((e) => ({ status: 0, statusText: String(e?.message ?? e) }) as any)
    if (r.status === 0) return res.json({ ok: false, message: `تعذّر الاتصال بثواني: ${r.statusText}` })
    if (r.status === 401 || r.status === 403) return res.json({ ok: false, status: r.status, message: "المفتاح السري مرفوض من ثواني" })
    return res.json({ ok: true, status: r.status, message: `المفتاح مقبول (${c.mode === "live" ? "حقيقي" : "تجريبي"})` })
  }
  if (p === "whatsapp") {
    const c = whatsappCreds()
    if (!c.accessToken || !c.phoneNumberId) return res.json({ ok: false, message: "رمز الوصول أو معرّف الرقم غير مضبوط" })
    const r = await fetch(`https://graph.facebook.com/v21.0/${c.phoneNumberId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${c.accessToken}` }, signal: timeout }).catch((e) => ({ status: 0, statusText: String(e?.message ?? e) }) as any)
    if (r.status === 0) return res.json({ ok: false, message: `تعذّر الاتصال بـ Meta: ${r.statusText}` })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return res.json({ ok: false, status: r.status, message: `رفضت Meta: ${body?.error?.message ?? r.status}`.slice(0, 200) })
    return res.json({ ok: true, message: `متصل: ${body.display_phone_number ?? ""} — ${body.verified_name ?? ""}` })
  }
  throw new MedusaError(MedusaError.Types.NOT_FOUND, "منصة غير معروفة")
}
