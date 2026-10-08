import { ReactNode, useCallback } from "react"
import { useTranslation } from "react-i18next"

/**
 * المرحلة 5 (لغات — لوحة التاجر): كل نصوص صفحات نقلة وويدجتاتها من i18n/json/{ar,en}.json تحت «naqla.»،
 * والاتجاه من لوحة Medusa نفسها (dir على <html> حسب لغة المستخدم) — لا dir ثابت في المكوّنات.
 * لغة غير العربية والإنجليزية في Medusa (فرنسية…) تأخذ نصوص الإنجليزية (fallbackLng = en).
 */
export type Lang = "ar" | "en"
export const langOf = (l?: string | null): Lang => (String(l ?? "").toLowerCase().startsWith("ar") ? "ar" : "en")

export function useNaqlaT() {
  const { t: raw, i18n } = useTranslation()
  const lang = langOf(i18n.resolvedLanguage ?? i18n.language)
  const t = useCallback((key: string, opts?: Record<string, unknown>) => String(raw(`naqla.${key}`, opts as any)), [raw])
  /** ترجمة اختيارية: المفتاح إن وُجد، وإلا البديل كما هو (أسماء حقول/صيغ قادمة من الخادم) */
  const tOr = useCallback((key: string, fallback: string) => (i18n.exists(`naqla.${key}`) ? t(key) : fallback), [i18n, t])
  /**
   * رسالة الخادم: رمز ثابت `code {"param":…}` (lib/admin-i18n.ts في الخادم) ← naqla.errors.<code>؛
   * معامل field ← naqla.fields.<key>، format ← naqla.formats.<key>، context ← مخاطبة المتجر.
   * غير الرمز (أخطاء Medusa نفسها أو الشبكة) يُعرض كما هو.
   */
  const errorText = useCallback((message: string) => {
    const m = /^([a-z_]+)(?: (\{.*\}))?$/.exec(String(message ?? ""))
    if (!m || !i18n.exists(`naqla.errors.${m[1]}`)) return String(message ?? "")
    let params: Record<string, unknown> = {}
    try { params = m[2] ? JSON.parse(m[2]) : {} } catch { /* بلا معاملات */ }
    if (typeof params.field === "string") params.field = tOr(`fields.${params.field.replace(/\./g, "_")}`, params.field)
    if (typeof params.format === "string") params.format = tOr(`formats.${params.format}`, params.format)
    return t(`errors.${m[1]}`, params)
  }, [i18n, t, tOr])
  /** رمز «~…» من الخادم (مصادر الطلبات، قيم سجل التغييرات) ← naqla.tokens.<…>؛ غيره نص بيانات كما هو */
  const token = useCallback((v: unknown) => (typeof v === "string" && v.startsWith("~") ? tOr(`tokens.${v.slice(1)}`, v) : v), [tOr])
  // مكوّنات Radix في @medusajs/ui (Tabs, Select) اتجاهها ltr افتراضياً ولا ترث dir من <html> — تُمرَّر لها صراحة
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr"
  return { t, tOr, lang, dir, errorText, token, i18n }
}

/** fetch لمسارات نقلة بلغة اللوحة (x-naqla-lang): الخادم يعيد الأسماء (محافظات، مستويات، منتجات) بها */
export const naqlaFetch = (path: string, lang: Lang, init: RequestInit = {}) =>
  fetch(path, { credentials: "include", ...init, headers: { "Content-Type": "application/json", "x-naqla-lang": lang, ...(init.headers ?? {}) } })

/** يرمي رسالة الخادم كما هي (رمزاً أو نصاً) لتترجمها errorText */
export async function naqlaApi<T = any>(path: string, lang: Lang, init?: RequestInit): Promise<T> {
  const res = await naqlaFetch(path, lang, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`)
  return body
}

/**
 * بيانات المتجر داخل نص اللوحة (أسماء المنتجات والزبائن والقيم المحفوظة): تُعزل اتجاهياً (bdi)
 * وتُعلَّم data-content — فحص stage5 يستثنيها من «لا عربي في الإنجليزية» لأنها محتوى لا نص واجهة.
 */
export const Data = ({ children, dir }: { children?: ReactNode; dir?: "ltr" | "rtl" | "auto" }) => (
  <bdi data-content="" dir={dir}>{children}</bdi>
)
