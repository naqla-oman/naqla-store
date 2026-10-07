import { MedusaError } from "@medusajs/framework/utils"

/**
 * المرحلة 4 (لغات): أخطاء المتجر برموز ثابتة بدل النصوص العربية.
 * الرسالة التي تصل الواجهة: `<code>` أو `<code> {"param":"…"}` — والواجهة تترجمها من messages/{ar,en}.json → errors.<code>
 * (نفس الرمز في لوحة العميل يبقى عربياً عبر AR_TEXT للسجلات ولوحة Medusa).
 * الرموز مستقرة: لا تُعاد تسميتها بعد النشر لأن الواجهة والقوالب تعتمد عليها.
 */
export const STORE_ERRORS = {
  // رمز الدخول بواتساب
  otp_busy: "الخادم مشغول — حاول بعد لحظات",
  otp_phone_invalid: "رقم الهاتف غير صحيح",
  otp_device_limit: "طلبات كثيرة من هذا الجهاز — حاول بعد ساعة",
  otp_cooldown: "انتظري {wait} ثانية قبل طلب رمز جديد",
  otp_daily_limit: "تجاوزت عدد الرموز المسموح اليوم لهذا الرقم — حاول غداً أو تواصل معنا",
  otp_format: "أدخلي الرمز المكوّن من 6 أرقام",
  otp_attempts_device: "محاولات كثيرة من هذا الجهاز — حاول بعد ساعة",
  otp_not_requested: "اطلبي رمزاً أولاً",
  otp_request_new: "اطلبي رمزاً جديداً",
  otp_expired: "انتهت صلاحية الرمز — اطلبي رمزاً جديداً",
  otp_exhausted: "تجاوزتِ عدد المحاولات — اطلبي رمزاً جديداً",
  otp_wrong: "الرمز غير صحيح (تبقّى {left})",
  otp_disabled: "WhatsApp غير مفعّل — لا يمكن إرسال الرمز",
  // الحساب
  account_exists: "الحساب موجود مسبقاً",
  verify_phone_first: "تحققي من رقمك أولاً",
  name_required: "أدخلي اسمك",
  email_invalid: "البريد الإلكتروني غير صحيح",
  email_taken: "هذا البريد مستخدم في حساب آخر",
  no_phone_on_account: "لا يوجد رقم هاتف في الحساب",
  loyalty_disabled: "برنامج الولاء غير مفعّل",
  loyalty_need_points: "تحتاجين {need} نقطة متاحة — رصيدك {available}",
  loyalty_insufficient: "الرصيد لا يكفي للاستبدال",
  // السلة والدفع
  cart_not_found: "السلة غير موجودة",
  thawani_session_missing: "جلسة ثواني غير موجودة لهذه السلة",
  length_range: "الطول يجب أن يكون بين {min} و{max} سم",
  tailoring_from_product: "التفصيل الخاص يُطلب من صفحة القطعة المراد تفصيلها",
  code_not_combinable: "الكود {code} لا يُجمع مع أكواد خصم أخرى",
  code_first_order_only: "الكود {code} لأول طلب فقط",
  shipping_price_changed: "تغيّر سعر التوصيل بعد تعديل السلة — أعد اختيار طريقة التوصيل",
  governorate_unknown: "المحافظة غير معروفة",
  governorate_unavailable: "التوصيل غير متاح حالياً إلى محافظة {gov}",
  wilayat_mismatch: "الولاية «{city}» لا تتبع محافظة {gov}",
  // التتبع والطلبات
  order_not_found_track: "لم نجد طلباً بهذا الرقم وهذا الهاتف",
  order_not_found: "الطلب غير موجود",
  no_redirect: "لا يوجد تحويل",
} as const
export type StoreErrorCode = keyof typeof STORE_ERRORS

type Params = Record<string, string | number>
/** الرسالة المشفَّرة كما تصل الواجهة */
export const storeErrorMessage = (code: StoreErrorCode, params?: Params) => (params && Object.keys(params).length ? `${code} ${JSON.stringify(params)}` : code)
/** MedusaError برمز ثابت */
export const storeError = (type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types], code: StoreErrorCode, params?: Params) =>
  new MedusaError(type, storeErrorMessage(code, params))
/** النص العربي (للسجلات ولوحة العميل) */
export const storeErrorText = (code: StoreErrorCode, params: Params = {}) => STORE_ERRORS[code].replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""))
/** فكّ رسالة مشفَّرة: { code, params } أو null إن لم تكن رمزاً */
export function parseStoreError(message: string): { code: StoreErrorCode; params: Params } | null {
  const m = /^([a-z_]+)(?: (\{.*\}))?$/.exec(message ?? "")
  if (!m || !(m[1] in STORE_ERRORS)) return null
  let params: Params = {}
  try { params = m[2] ? JSON.parse(m[2]) : {} } catch { /* بلا معاملات */ }
  return { code: m[1] as StoreErrorCode, params }
}
