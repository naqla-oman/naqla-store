import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { thawaniCreds, whatsappCreds } from "../../../../../../../lib/credentials"
import { adminError, adminErrorMessage } from "../../../../../../../lib/admin-i18n"

/**
 * POST /admin/naqla/store-settings/payments/test/thawani|whatsapp — يختبر المفاتيح الفعلية دون أي أثر:
 * ثواني: قراءة جلسة غير موجودة (401 = مفتاح خاطئ، غيره = المفتاح مقبول). واتساب: بيانات الرقم من Meta.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const p = req.params.platform
  const timeout = AbortSignal.timeout(15000)
  if (p === "thawani") {
    const c = thawaniCreds()
    if (!c.secretKey || !c.publishableKey) return res.json({ ok: false, message: adminErrorMessage("thawani_keys_missing") })
    const base = c.mode === "live" ? "https://checkout.thawani.om" : "https://uatcheckout.thawani.om"
    const r = await fetch(`${base}/api/v1/checkout/session/naqla_key_check`, { headers: { "thawani-api-key": c.secretKey }, signal: timeout }).catch((e) => ({ status: 0, statusText: String(e?.message ?? e) }) as any)
    if (r.status === 0) return res.json({ ok: false, message: adminErrorMessage("thawani_unreachable", { detail: String(r.statusText) }) })
    if (r.status === 401 || r.status === 403) return res.json({ ok: false, status: r.status, message: adminErrorMessage("thawani_rejected") })
    return res.json({ ok: true, status: r.status, message: adminErrorMessage(c.mode === "live" ? "thawani_ok_live" : "thawani_ok_uat") })
  }
  if (p === "whatsapp") {
    const c = whatsappCreds()
    if (!c.accessToken || !c.phoneNumberId) return res.json({ ok: false, message: adminErrorMessage("whatsapp_keys_missing") })
    const r = await fetch(`https://graph.facebook.com/v21.0/${c.phoneNumberId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${c.accessToken}` }, signal: timeout }).catch((e) => ({ status: 0, statusText: String(e?.message ?? e) }) as any)
    if (r.status === 0) return res.json({ ok: false, message: adminErrorMessage("meta_unreachable", { detail: String(r.statusText) }) })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return res.json({ ok: false, status: r.status, message: adminErrorMessage("meta_rejected", { detail: String(body?.error?.message ?? r.status).slice(0, 180) }) })
    return res.json({ ok: true, message: adminErrorMessage("whatsapp_ok", { phone: String(body.display_phone_number ?? ""), name: String(body.verified_name ?? "") }) })
  }
  throw adminError(MedusaError.Types.NOT_FOUND, "platform_unknown")
}
