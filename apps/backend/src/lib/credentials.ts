import { open } from "./secret-box"

/**
 * تبويب «الدفع والتواصل»: مفاتيح ثواني وواتساب من إعدادات المتجر (مشفّرة في القاعدة) ثم .env احتياطاً.
 * مخزن في الذاكرة يُحمَّل عند الإقلاع ويُحدَّث عند الحفظ — المزوّدون يقرؤونه عند كل استدعاء.
 */
let plain: Record<string, string> = {}

export const SECRET_KEYS = ["thawani.secretKey", "thawani.publishableKey", "thawani.mode", "whatsapp.accessToken", "whatsapp.phoneNumberId", "whatsapp.businessAccountId"] as const
export type SecretKey = (typeof SECRET_KEYS)[number]

export function setSealedSecrets(sealed: Record<string, string | null> | null | undefined) {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(sealed ?? {})) {
    try { const p = open(v); if (p) next[k] = p } catch { /* مفتاح تشفير تغيّر: يُتجاهل ويُعاد إدخاله */ }
  }
  plain = next
}

export const secretFromSettings = (k: SecretKey) => plain[k] ?? null

const ENV: Record<SecretKey, string> = {
  "thawani.secretKey": "THAWANI_SECRET_KEY",
  "thawani.publishableKey": "THAWANI_PUBLISHABLE_KEY",
  "thawani.mode": "THAWANI_MODE",
  "whatsapp.accessToken": "WHATSAPP_ACCESS_TOKEN",
  "whatsapp.phoneNumberId": "WHATSAPP_PHONE_NUMBER_ID",
  "whatsapp.businessAccountId": "WHATSAPP_BUSINESS_ACCOUNT_ID",
}
/** القيمة الفعلية ومصدرها: settings (اللوحة) ثم env */
export function credential(k: SecretKey): { value: string | null; source: "settings" | "env" | null } {
  if (plain[k]) return { value: plain[k], source: "settings" }
  const e = process.env[ENV[k]]
  return e ? { value: e, source: "env" } : { value: null, source: null }
}

export function thawaniCreds() {
  return {
    secretKey: credential("thawani.secretKey").value,
    publishableKey: credential("thawani.publishableKey").value,
    mode: credential("thawani.mode").value === "live" ? ("live" as const) : ("uat" as const),
  }
}

export function whatsappCreds() {
  return { accessToken: credential("whatsapp.accessToken").value, phoneNumberId: credential("whatsapp.phoneNumberId").value }
}

/**
 * هل إرسال واتساب الحقيقي مفعّل؟ الرمز ومعرّف الرقم موجودان (من اللوحة أو .env)، والتفعيل إمّا
 * WHATSAPP_ENABLED=true أو مفتاح محفوظ في «إعدادات المتجر» (مسار التاجر الرسمي). وإلا وضع السجل.
 * مصدر واحد تستعمله خدمة واتساب وnotifyOrder (الرجوع إلى القالب العربي) ولوحة القوالب.
 */
export function whatsappEnabled(envEnabled = process.env.WHATSAPP_ENABLED === "true") {
  const c = whatsappCreds()
  return !!c.accessToken && !!c.phoneNumberId && (envEnabled || !!secretFromSettings("whatsapp.accessToken"))
}
