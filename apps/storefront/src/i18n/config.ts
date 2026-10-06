/** اللغات: العربية الأصل بلا بادئة (/om/…)، والإنجليزية طبقة فوقها (/om/en/…) */
export const LOCALES = ["ar", "en"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "ar"
export const LANG_COOKIE = "lang"
export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly string[]).includes(String(v))
/** بادئة اللغة في الرابط: لا شيء للعربية، /en للإنجليزية */
export const langPrefix = (lang?: unknown) => (isLocale(lang) && lang !== DEFAULT_LOCALE ? `/${lang}` : "")
export const dirOf = (lang: string) => (lang === "ar" ? "rtl" : "ltr")
