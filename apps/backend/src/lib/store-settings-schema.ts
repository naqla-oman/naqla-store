import { client, clientDefaults } from "./client"
import { type AdminErrorCode, adminErrorMessage } from "./admin-i18n"
import { thawaniConfigured } from "./thawani-env"
import { themePresets } from "./themes"

/**
 * القائمة البيضاء لمفاتيح «إعدادات المتجر» القابلة للتعديل من لوحة العميل، مع التحقق من كل حقل على الخادم.
 * المفتاح مسار نقطي في store.json (features.loyalty). ما لا يرد هنا مقفل (هوية نقلة، الدومين، الأسرار التقنية…).
 */
/** خطأ تحقق برمز ثابت (admin-i18n): الرسالة `code {params}` تترجمها اللوحة */
export class SettingsError extends Error {
  constructor(code: AdminErrorCode, params?: Record<string, string | number>) { super(adminErrorMessage(code, params)) }
}
type Check = (v: unknown) => unknown
const fail = (code: AdminErrorCode, params?: Record<string, string | number>): never => { throw new SettingsError(code, params) }

const bool: Check = (v) => (typeof v === "boolean" ? v : fail("bool_invalid"))
const text = (max: number, min = 0, label = "text"): Check => (v) => {
  if (v === null || v === undefined || v === "") return min ? fail("field_required", { field: label }) : null
  if (typeof v !== "string") return fail("field_text", { field: label })
  const s = v.trim().replace(/\s+/g, " ")
  if (s.length < min) fail("field_min", { field: label, min })
  if (s.length > max) fail("field_max", { field: label, max })
  if (/[<>]/.test(s)) fail("field_angle", { field: label })
  return s
}
const int = (min: number, max: number, label: string, nullable = false): Check => (v) => {
  if ((v === null || v === "") && nullable) return null
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : fail("field_int_range", { field: label, min, max })
}
const email: Check = (v) => (v === null || v === "" ? null : typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? v.trim().toLowerCase() : fail("email_invalid"))
const phoneDigits = (label: string): Check => (v) => {
  if (v === null || v === "") return null
  const d = String(v).replace(/[\s\-()]/g, "")
  return /^\+?\d{8,15}$/.test(d) ? d : fail("field_phone", { field: label })
}
const url = (label: string): Check => (v) => {
  if (v === null || v === "") return null
  return typeof v === "string" && /^https:\/\/[^\s<>"]+$/.test(v.trim()) && v.length <= 200 ? v.trim() : fail("field_https", { field: label })
}
const oneOf = (vals: string[], label: string): Check => (v) => (vals.includes(String(v)) ? String(v) : fail("field_not_allowed", { field: label }))

const FEATURES = ["tailoring", "sizeGuide", "lengthField", "gift", "expressDelivery", "pickup", "loyalty", "loyaltyTiers", "cod", "thawani", "whatsappOrder", "bnpl", "reviews"]

/** رابط صورة هوية: من مجلد هوية المتجر المرفوع، أو قيمة store.json الافتراضية (أو null للأيقونة svg) */
const brandAsset = (key: string): Check => (v) => {
  // null = العودة لافتراضي store.json (قد لا يحوي مفتاح icons أصلاً)
  if (v === null || v === "") return null
  const s = String(v ?? "")
  const prefix = `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static/${client().slug}/brand/`
  if (s.startsWith(prefix) && /^[a-z0-9-]+\.png$/.test(s.slice(prefix.length))) return s
  if (s && s === getPath(clientDefaults(), key)) return s
  return fail("image_upload_only")
}

/** لوحة/خط: من اللوحات الجاهزة، أو «custom» فقط إن كانت هوية العميل الافتراضية مخصصة من نقلة */
const preset = (kind: "palettes" | "fonts", label: string): Check => (v) => {
  // null = العودة للافتراضي (لوحة/خط العميل المكتشفان)
  if (v === null || v === "") return (clientDefaults() as any).theme?.[kind === "palettes" ? "palette" : "font"] ?? null
  const s = String(v)
  if (themePresets()[kind].some((p) => p.slug === s)) return s
  const def = (clientDefaults() as any).theme?.[kind === "palettes" ? "palette" : "font"]
  return s === "custom" && def === "custom" ? s : fail("field_unavailable", { field: label })
}

export const SCHEMA: Record<string, { tab: string; check: Check }> = {
  // 1) الهوية
  name: { tab: "identity", check: text(60, 2, "name") },
  shortName: { tab: "identity", check: text(24, 2, "shortName") },
  tagline: { tab: "identity", check: text(120, 0, "tagline") },
  description: { tab: "identity", check: text(300, 0, "description") },
  "theme.palette": { tab: "identity", check: preset("palettes", "theme.palette") },
  "theme.font": { tab: "identity", check: preset("fonts", "theme.font") },
  "brand.wordmark": { tab: "identity", check: bool },
  // الصور تُعيَّن فقط عبر مسار الرفع (روابط مجلد هوية المتجر) أو تعود لافتراضي store.json
  ...Object.fromEntries(["brand.logo", "icons.icon192", "icons.icon512", "icons.maskable", "icons.apple", "icons.svg"].map((k) => [k, { tab: "identity", check: brandAsset(k) }])),
  // 2) الميزات
  ...Object.fromEntries(FEATURES.map((f) => [`features.${f}`, { tab: "features", check: bool }])),
  // 2) اللغات (تبويب الميزات): العربية دائماً؛ الإنجليزية اختيارية
  languages: { tab: "features", check: (v) => { const a = Array.isArray(v) ? [...new Set(v.map(String))] : null; return a && a.includes("ar") && a.every((x) => ["ar", "en"].includes(x)) ? a : fail("languages_invalid") } },
  defaultLanguage: { tab: "features", check: oneOf(["ar", "en"], "defaultLanguage") },
  // 3) المخاطبة
  voice: { tab: "voice", check: oneOf(["f", "m", "neutral"], "voice") },
  // 4) التوصيل (الأسعار والمحافظات في Medusa — هنا ما ليس من بيانات Medusa)
  cutoffHour: { tab: "shipping", check: int(8, 23, "cutoffHour") },
  deliveryOffDays: {
    tab: "shipping",
    check: (v) => (Array.isArray(v) && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && v.length < 7 ? [...new Set(v as number[])].sort() : fail("offdays_invalid")),
  },
  // 5) الدفع والتواصل: أرقام التاجر للتنبيهات (الأسرار في saveSecrets)
  merchantPhones: {
    tab: "payments",
    check: (v) => {
      if (!Array.isArray(v)) return fail("merchant_phones_list")
      const out = [...new Set(v.map((x) => String(x).replace(/[\s\-()+]/g, "")).filter(Boolean))]
      if (out.length > 5) fail("merchant_phones_max")
      if (!out.every((x) => /^\d{8,15}$/.test(x))) fail("merchant_phones_format")
      return out
    },
  },
  // 6) بيانات المتجر
  "contact.phone": { tab: "store", check: phoneDigits("contact.phone") },
  "contact.whatsapp": { tab: "store", check: phoneDigits("contact.whatsapp") },
  "contact.email": { tab: "store", check: email },
  "contact.address": { tab: "store", check: text(160, 0, "contact.address") },
  "contact.hours": { tab: "store", check: text(120, 0, "contact.hours") },
  "social.instagram": { tab: "store", check: url("social.instagram") },
  "social.snapchat": { tab: "store", check: url("social.snapchat") },
  "social.tiktok": { tab: "store", check: url("social.tiktok") },
  "social.x": { tab: "store", check: url("social.x") },
  "location.name": { tab: "store", check: text(80, 2, "location.name") },
  "location.address": { tab: "store", check: text(160, 2, "location.address") },
  "location.province": {
    tab: "store",
    check: (v) => ((client() as any).checkout?.governorates ?? []).some((x: any) => x.code === v) ? v : fail("pickup_province_unknown"),
  },
  "location.wilayat": { tab: "store", check: text(40, 2, "location.wilayat") },
  "legal.cr": { tab: "store", check: (v) => (v === null || v === "" ? null : /^\d{1,12}$/.test(String(v).trim()) ? String(v).trim() : fail("cr_digits")) },
  "legal.vat": { tab: "store", check: (v) => (v === null || v === "" ? null : /^OM\d{10}$/i.test(String(v).trim()) ? String(v).trim().toUpperCase() : fail("vat_format")) },
  returnDays: { tab: "store", check: int(0, 60, "returnDays") },
  "reservationHours.whatsapp": { tab: "store", check: int(1, 720, "reservationHours.whatsapp", true) },
  "reservationHours.pickup": { tab: "store", check: int(1, 720, "reservationHours.pickup", true) },
}

export const getPath = (o: any, path: string) => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o)
export function setPath(o: Record<string, any>, path: string, v: unknown) {
  const ks = path.split(".")
  let x = o
  for (const k of ks.slice(0, -1)) x = x[k] = x[k] && typeof x[k] === "object" ? x[k] : {}
  x[ks[ks.length - 1]] = v
}

/** صيغة أسرار الدفع والتواصل (تُحفظ مشفّرة) */
export function checkSecret(key: string, v: string) {
  const rules: Record<string, [RegExp, AdminErrorCode]> = {
    "thawani.secretKey": [/^[A-Za-z0-9_\-]{16,200}$/, "thawani_secret_format"],
    "thawani.publishableKey": [/^[A-Za-z0-9_\-]{16,200}$/, "thawani_publishable_format"],
    "thawani.mode": [/^(uat|live)$/, "thawani_mode_invalid"],
    "whatsapp.accessToken": [/^[A-Za-z0-9_\-.|]{20,600}$/, "whatsapp_token_invalid"],
    "whatsapp.phoneNumberId": [/^\d{10,20}$/, "whatsapp_phone_id_format"],
    "whatsapp.businessAccountId": [/^\d{10,20}$/, "whatsapp_waba_format"],
  }
  const r = rules[key]
  if (r && !r[0].test(v)) fail(r[1])
}

/** قيود بين الحقول على القيمة الفعلية بعد الدمج — قائمة المخالفات (مفتاح ← رمز الخطأ) */
export function crossIssues(eff: any): Record<string, AdminErrorCode> {
  const f = eff.features ?? {}
  const out: Record<string, AdminErrorCode> = {}
  if (f.loyaltyTiers && !f.loyalty) out.tiers = "tiers_need_loyalty"
  if (!f.cod && !f.thawani && !f.whatsappOrder) out.payment = "payment_required"
  if (eff.defaultLanguage && !(eff.languages ?? ["ar"]).includes(eff.defaultLanguage)) out.language = "default_language_disabled"
  if (f.thawani && !thawaniConfigured()) out.thawani = "thawani_need_keys"
  return out
}
/** يرفض فقط المخالفات التي يُدخلها التغيير (حالة قائمة لا تمنع حفظ إعداد لا يخصها) */
export function crossCheck(after: any, before?: any) {
  const prev = before ? crossIssues(before) : {}
  const fresh = Object.entries(crossIssues(after)).filter(([k]) => !(k in prev))
  if (fresh.length) fail(fresh[0][1])
}
