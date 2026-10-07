import { MedusaError } from "@medusajs/framework/utils"
import { client, type ClientStore } from "./client"
import { storeDataEn } from "./store-data"

/**
 * المرحلة 5 (لغات — لوحة التاجر): رسائل مسارات /admin/naqla و/admin/seo و/admin/tracking برموز ثابتة،
 * وبيانات المتجر بلغة اللوحة.
 *
 * الرسالة كما تصل اللوحة: `<code>` أو `<code> {"param":…}` (صيغة store-errors نفسها) — وصفحات نقلة تترجمها من
 * src/admin/i18n/json/{ar,en}.json → naqla.errors.<code>. معاملات خاصة تترجمها اللوحة أيضاً:
 *   field ← naqla.fields.<key> (مفتاح الحقل، النقاط تصبح _)، format ← naqla.formats.<key>، context ← مخاطبة المتجر (f/m/neutral).
 * النص العربي هنا للسجلات فقط. الرموز مستقرة: لا تُعاد تسميتها بعد النشر.
 */
export const ADMIN_ERRORS = {
  // التحقق من حقول «إعدادات المتجر»
  bool_invalid: "قيمة تشغيل/إيقاف غير صحيحة",
  field_required: "{field} مطلوب",
  field_text: "{field}: قيمة نصية مطلوبة",
  field_min: "{field}: {min} أحرف على الأقل",
  field_max: "{field}: {max} حرفاً كحد أقصى",
  field_angle: "{field}: لا يُسمح بالرمزين < و >",
  field_int_range: "{field}: رقم صحيح بين {min} و{max}",
  field_phone: "{field}: أرقام فقط (8–15) مع رمز الدولة",
  field_https: "{field}: رابط يبدأ بـ https://",
  field_not_allowed: "{field}: قيمة غير مسموحة",
  field_unavailable: "{field}: اختيار غير متاح",
  field_format: "{field}: صيغة غير صحيحة — {format}",
  email_invalid: "تحقق من البريد الإلكتروني",
  image_upload_only: "الصورة تُرفع من زر الرفع في تبويب الهوية",
  languages_invalid: "اللغات: العربية إلزامية، والإنجليزية اختيارية",
  offdays_invalid: "أيام العطل: أيام الأسبوع 0–6، ويبقى يوم عمل واحد على الأقل",
  merchant_phones_list: "أرقام التاجر: قائمة أرقام",
  merchant_phones_max: "5 أرقام كحد أقصى",
  merchant_phones_format: "أرقام التاجر: أرقام فقط (8–15) مع رمز الدولة",
  pickup_province_unknown: "محافظة موقع الاستلام غير معروفة",
  cr_digits: "السجل التجاري: أرقام فقط",
  vat_format: "الرقم الضريبي بصيغة OM ثم 10 أرقام",
  key_not_editable: "المفتاح «{key}» غير قابل للتعديل من اللوحة",
  db_required: "اتصال القاعدة مطلوب للحفظ",
  values_required: "values مطلوبة",
  // قيود بين الحقول
  tiers_need_loyalty: "المستويات تتطلب تفعيل الولاء أولاً",
  payment_required: "فعّل طريقة دفع واحدة على الأقل",
  default_language_disabled: "اللغة الافتراضية يجب أن تكون من اللغات المفعّلة",
  thawani_need_keys: "ثواني يتطلب مفاتيحه أولاً — أدخلها في تبويب «الدفع والتواصل»",
  // الأسرار
  thawani_secret_format: "المفتاح السري لثواني: حروف وأرقام بلا مسافات",
  thawani_publishable_format: "مفتاح النشر لثواني: حروف وأرقام بلا مسافات",
  thawani_mode_invalid: "وضع ثواني: تجريبي أو حقيقي",
  whatsapp_token_invalid: "رمز وصول واتساب غير صحيح",
  whatsapp_phone_id_format: "معرّف رقم واتساب: أرقام (10–20)",
  whatsapp_waba_format: "معرّف حساب واتساب للأعمال: أرقام (10–20)",
  // التوصيل
  amount_range: "{field}: رقم بين 0 و1000",
  amount_decimals: "{field}: 3 منازل عشرية كحد أقصى",
  governorate_unknown_in: "{field}: محافظة غير معروفة",
  free_over_gt_amount: "حد التوصيل المجاني يجب أن يكون أكبر من سعر التوصيل",
  express_province_required: "اختر محافظة واحدة على الأقل للتوصيل السريع أو أطفئه من الميزات",
  governorate_required: "فعّل محافظة واحدة على الأقل",
  // صور الهوية
  image_kind: "نوع الصورة: logo أو icon",
  image_invalid: "ملف صورة غير صالح",
  image_too_large: "حجم الصورة أكبر من 5 ميغابايت",
  image_type: "الصورة يجب أن تكون PNG أو JPEG أو WebP (لا SVG)",
  logo_too_small: "الشعار صغير جداً — 64 بكسل على الأقل",
  icon_too_small: "الأيقونة صغيرة جداً — 192×192 بكسل على الأقل",
  icon_not_square: "الأيقونة يجب أن تكون مربعة تقريباً",
  // اختبار المفاتيح (نتيجة لا خطأ: { ok, message })
  thawani_keys_missing: "مفاتيح ثواني غير مضبوطة",
  thawani_unreachable: "تعذّر الاتصال بثواني: {detail}",
  thawani_rejected: "المفتاح السري مرفوض من ثواني",
  thawani_ok_live: "المفتاح مقبول (حقيقي)",
  thawani_ok_uat: "المفتاح مقبول (تجريبي)",
  whatsapp_keys_missing: "رمز الوصول أو معرّف الرقم غير مضبوط",
  meta_unreachable: "تعذّر الاتصال بـ Meta: {detail}",
  meta_rejected: "رفضت Meta: {detail}",
  whatsapp_ok: "متصل: {phone} — {name}",
  // السيو والتتبع والملفات
  seo_kind_unknown: "kind غير معروف",
  seo_handle_format: "الرابط: حروف لاتينية صغيرة وأرقام وشرطات فقط",
  platform_unknown: "منصة غير معروفة",
  tracking_no_pixel: "لا يوجد Pixel ID أو رمز وصول",
  tracking_no_ga4: "لا يوجد Measurement ID أو API secret",
  not_found: "غير موجود",
} as const
export type AdminErrorCode = keyof typeof ADMIN_ERRORS

/** رموز بصيغتين حسب مخاطبة المتجر (naqla.errors.<code>_f في ar.json) */
const GENDERED = new Set<AdminErrorCode>(["email_invalid", "payment_required", "thawani_need_keys", "express_province_required", "governorate_required"])

type Params = Record<string, string | number>
export const adminErrorMessage = (code: AdminErrorCode, params: Params = {}) => {
  const p: Params = GENDERED.has(code) ? { ...params, context: String((client() as any).voice ?? "neutral") } : params
  return Object.keys(p).length ? `${code} ${JSON.stringify(p)}` : code
}
/** MedusaError برمز ثابت */
export const adminError = (type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types], code: AdminErrorCode, params?: Params) =>
  new MedusaError(type, adminErrorMessage(code, params))
/** النص العربي (للسجلات) */
export const adminErrorText = (code: AdminErrorCode, params: Params = {}) => ADMIN_ERRORS[code].replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""))

/** لغة لوحة التاجر: ترويسة x-naqla-lang التي ترسلها صفحات نقلة (ar افتراضياً) */
export const adminLang = (req: { headers: Record<string, unknown> }): "ar" | "en" =>
  String(req.headers["x-naqla-lang"] ?? "").toLowerCase().startsWith("en") ? "en" : "ar"

/**
 * طبقة نصوص المتجر الإنجليزية (قسم store في locales/en.json) فوق الإعداد الفعلي — بنفس قواعد الواجهة
 * (apps/storefront/src/i18n/store-config.ts): المصفوفات تُطابَق بـ key/id/code إن وُجد في كل العناصر وإلا بالفهرس،
 * والحقل الناقص يبقى بالعربية. القيم المخزَّنة (رموز المحافظات وأسماء الولايات) تبقى عربية — تُترجم تسمياتها فقط.
 */
type AnyObj = Record<string, unknown>
const isObj = (v: unknown): v is AnyObj => !!v && typeof v === "object" && !Array.isArray(v)
const idOf = (v: unknown) => (isObj(v) ? ((v.key ?? v.id ?? v.code) as string | undefined) : undefined)
export function overlay<T>(base: T, over: unknown): T {
  if (over == null) return base
  if (Array.isArray(base)) {
    if (!Array.isArray(over)) return base
    if (base.every((b) => !isObj(b))) return over.length ? (over.map((o, i) => (o == null ? base[i] : o)) as T) : base
    const keyed = over.length > 0 && over.every((o) => idOf(o) !== undefined)
    return base.map((b, i) => {
      const o = keyed ? over.find((x) => idOf(x) === idOf(b)) : over[i]
      return o == null ? b : overlay(b, o)
    }) as T
  }
  if (isObj(base)) {
    if (!isObj(over)) return base
    const out: AnyObj = { ...base }
    for (const [k, v] of Object.entries(over)) if (k in out || v != null) out[k] = k in out ? overlay(out[k], v) : v
    return out as T
  }
  return typeof over === typeof base ? (over as T) : base
}

let enCache: { base: ClientStore; value: ClientStore } | null = null
/** إعداد المتجر بلغة اللوحة (للعرض فقط — لا يُحفظ) */
export function clientIn(lang: "ar" | "en"): ClientStore {
  const base = client()
  if (lang === "ar") return base
  if (enCache?.base === base) return enCache.value
  const value = overlay(base, storeDataEn() ?? {})
  enCache = { base, value }
  return value
}

/** وحدة العملة بلغة اللوحة: ر.ع للعربية، ورمز ISO للإنجليزية (OMR) */
export const currencyLabelIn = (lang: "ar" | "en") => {
  const c = client() as any
  return lang === "en" ? String(c.currency ?? "").toUpperCase() : c.currencyLabel ?? String(c.currency ?? "").toUpperCase()
}

/** قيم ثابتة يكتبها الخادم في سجل التغييرات (محفوظة في القاعدة) ← رموز تترجمها اللوحة (naqla.settings.historyValues) */
export const HISTORY_TOKENS: Record<string, string> = { "الكل": "~all", "حُذف (يعود للإعداد التقني)": "~deleted", "تغيّر": "~changed", "أُضيف": "~added" }
