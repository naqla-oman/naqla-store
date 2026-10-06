import { client, clientDefaults } from "./client"
import { g } from "./voice"
import { thawaniConfigured } from "./thawani-env"
import { themePresets } from "./themes"

/**
 * القائمة البيضاء لمفاتيح «إعدادات المتجر» القابلة للتعديل من لوحة العميل، مع التحقق من كل حقل على الخادم.
 * المفتاح مسار نقطي في store.json (features.loyalty). ما لا يرد هنا مقفل (هوية نقلة، الدومين، الأسرار التقنية…).
 */
export class SettingsError extends Error {}
type Check = (v: unknown) => unknown
const fail = (m: string): never => { throw new SettingsError(m) }

const bool: Check = (v) => (typeof v === "boolean" ? v : fail("قيمة تشغيل/إيقاف غير صحيحة"))
const text = (max: number, min = 0, label = "النص"): Check => (v) => {
  if (v === null || v === undefined || v === "") return min ? fail(`${label} مطلوب`) : null
  if (typeof v !== "string") return fail(`${label}: قيمة نصية مطلوبة`)
  const s = v.trim().replace(/\s+/g, " ")
  if (s.length < min) fail(`${label}: ${min} أحرف على الأقل`)
  if (s.length > max) fail(`${label}: ${max} حرفاً كحد أقصى`)
  if (/[<>]/.test(s)) fail(`${label}: لا يُسمح بالرمزين < و >`)
  return s
}
const int = (min: number, max: number, label: string, nullable = false): Check => (v) => {
  if ((v === null || v === "") && nullable) return null
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : fail(`${label}: رقم صحيح بين ${min} و${max}`)
}
const email: Check = (v) => (v === null || v === "" ? null : typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? v.trim().toLowerCase() : fail(g("تحققي من البريد الإلكتروني", "تحقق من البريد الإلكتروني")))
const phoneDigits = (label: string): Check => (v) => {
  if (v === null || v === "") return null
  const d = String(v).replace(/[\s\-()]/g, "")
  return /^\+?\d{8,15}$/.test(d) ? d : fail(`${label}: أرقام فقط (8–15) مع رمز الدولة`)
}
const url = (label: string): Check => (v) => {
  if (v === null || v === "") return null
  return typeof v === "string" && /^https:\/\/[^\s<>"]+$/.test(v.trim()) && v.length <= 200 ? v.trim() : fail(`${label}: رابط يبدأ بـ https://`)
}
const oneOf = (vals: string[], label: string): Check => (v) => (vals.includes(String(v)) ? String(v) : fail(`${label}: قيمة غير مسموحة`))

const FEATURES = ["tailoring", "sizeGuide", "lengthField", "gift", "expressDelivery", "pickup", "loyalty", "loyaltyTiers", "cod", "thawani", "whatsappOrder", "bnpl", "reviews"]

/** رابط صورة هوية: من مجلد هوية المتجر المرفوع، أو قيمة store.json الافتراضية (أو null للأيقونة svg) */
const brandAsset = (key: string): Check => (v) => {
  if (v === null && key === "icons.svg") return null
  const s = String(v ?? "")
  const prefix = `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static/${client().slug}/brand/`
  if (s.startsWith(prefix) && /^[a-z0-9-]+\.png$/.test(s.slice(prefix.length))) return s
  if (s && s === getPath(clientDefaults(), key)) return s
  return fail("الصورة تُرفع من زر الرفع في تبويب الهوية")
}

/** لوحة/خط: من اللوحات الجاهزة، أو «custom» فقط إن كانت هوية العميل الافتراضية مخصصة من نقلة */
const preset = (kind: "palettes" | "fonts", label: string): Check => (v) => {
  const s = String(v ?? "")
  if (themePresets()[kind].some((p) => p.slug === s)) return s
  const def = (clientDefaults() as any).theme?.[kind === "palettes" ? "palette" : "font"]
  return s === "custom" && def === "custom" ? s : fail(`${label}: اختيار غير متاح`)
}

export const SCHEMA: Record<string, { tab: string; check: Check }> = {
  // 1) الهوية
  name: { tab: "identity", check: text(60, 2, "اسم المتجر") },
  shortName: { tab: "identity", check: text(24, 2, "الاسم المختصر") },
  tagline: { tab: "identity", check: text(120, 0, "الشعار النصي") },
  description: { tab: "identity", check: text(300, 0, "وصف المتجر") },
  "theme.palette": { tab: "identity", check: preset("palettes", "لوحة الألوان") },
  "theme.font": { tab: "identity", check: preset("fonts", "زوج الخطوط") },
  "brand.wordmark": { tab: "identity", check: bool },
  // الصور تُعيَّن فقط عبر مسار الرفع (روابط مجلد هوية المتجر) أو تعود لافتراضي store.json
  ...Object.fromEntries(["brand.logo", "icons.icon192", "icons.icon512", "icons.maskable", "icons.apple", "icons.svg"].map((k) => [k, { tab: "identity", check: brandAsset(k) }])),
  // 2) الميزات
  ...Object.fromEntries(FEATURES.map((f) => [`features.${f}`, { tab: "features", check: bool }])),
  // 3) المخاطبة
  voice: { tab: "voice", check: oneOf(["f", "m", "neutral"], "المخاطبة") },
  // 6) بيانات المتجر
  "contact.phone": { tab: "store", check: phoneDigits("هاتف المتجر") },
  "contact.whatsapp": { tab: "store", check: phoneDigits("رقم واتساب المتجر") },
  "contact.email": { tab: "store", check: email },
  "contact.address": { tab: "store", check: text(160, 0, "العنوان") },
  "contact.hours": { tab: "store", check: text(120, 0, "ساعات العمل") },
  "social.instagram": { tab: "store", check: url("رابط إنستغرام") },
  "social.snapchat": { tab: "store", check: url("رابط سناب شات") },
  "social.tiktok": { tab: "store", check: url("رابط تيك توك") },
  "social.x": { tab: "store", check: url("رابط X") },
  "location.name": { tab: "store", check: text(80, 2, "اسم موقع الاستلام") },
  "location.address": { tab: "store", check: text(160, 2, "عنوان موقع الاستلام") },
  "location.province": {
    tab: "store",
    check: (v) => ((client() as any).checkout?.governorates ?? []).some((x: any) => x.code === v) ? v : fail("محافظة موقع الاستلام غير معروفة"),
  },
  "location.wilayat": { tab: "store", check: text(40, 2, "ولاية موقع الاستلام") },
  "legal.cr": { tab: "store", check: (v) => (v === null || v === "" ? null : /^\d{1,12}$/.test(String(v).trim()) ? String(v).trim() : fail("السجل التجاري: أرقام فقط")) },
  "legal.vat": { tab: "store", check: (v) => (v === null || v === "" ? null : /^OM\d{10}$/i.test(String(v).trim()) ? String(v).trim().toUpperCase() : fail("الرقم الضريبي بصيغة OM ثم 10 أرقام")) },
  returnDays: { tab: "store", check: int(0, 60, "مدة الإرجاع بالأيام") },
  "reservationHours.whatsapp": { tab: "store", check: int(1, 720, "مدة حجز طلبات واتساب بالساعات", true) },
  "reservationHours.pickup": { tab: "store", check: int(1, 720, "مدة حجز طلبات الاستلام بالساعات", true) },
}

export const getPath = (o: any, path: string) => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o)
export function setPath(o: Record<string, any>, path: string, v: unknown) {
  const ks = path.split(".")
  let x = o
  for (const k of ks.slice(0, -1)) x = x[k] = x[k] && typeof x[k] === "object" ? x[k] : {}
  x[ks[ks.length - 1]] = v
}

/** قيود بين الحقول على القيمة الفعلية بعد الدمج */
export function crossCheck(eff: any) {
  const f = eff.features ?? {}
  if (f.loyaltyTiers && !f.loyalty) fail(g("المستويات تتطلب تفعيل الولاء أولاً", "المستويات تتطلب تفعيل الولاء أولاً"))
  if (!f.cod && !f.thawani && !f.whatsappOrder) fail(g("فعّلي طريقة دفع واحدة على الأقل", "فعّل طريقة دفع واحدة على الأقل"))
  if (f.thawani && !thawaniConfigured()) fail(g("ثواني يتطلب مفاتيحه أولاً — أدخليها في تبويب «الدفع والتواصل»", "ثواني يتطلب مفاتيحه أولاً — أدخلها في تبويب «الدفع والتواصل»"))
}
