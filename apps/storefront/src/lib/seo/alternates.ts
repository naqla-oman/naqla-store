import type { Metadata } from "next"
import { storeConfig } from "@/store.config"
import { langPrefix, isLocale, type Locale } from "@/i18n/config"
import { ensureStoreSettings } from "@lib/data/store-settings"

/**
 * المرحلة 3 (السيو): روابط اللغات لصفحة واحدة.
 * - canonical: رابط الصفحة باللغة الحالية (العربية بلا بادئة، الإنجليزية /en).
 * - hreflang: ar وen وx-default=ar — فقط حين تكون الإنجليزية مفعّلة في إعدادات المتجر؛
 *   في متجر بلغة واحدة لا يُعلن عن /en (الروابط تعطي 404).
 * - og:locale حسب لغة الصفحة (ar_OM / en_US) مع alternateLocale للأخرى.
 */
export const OG_LOCALE: Record<Locale, string> = { ar: "ar_OM", en: "en_US" }
export const HTML_LANG: Record<Locale, string> = { ar: "ar", en: "en" }

/** إعدادات اللوحة قد لا تكون مطبَّقة بعد حين تُحسب بيانات الصفحة قبل التخطيط الجذري (تتوازى) — نضمنها هنا */
export async function englishEnabled() {
  await ensureStoreSettings()
  return (storeConfig.languages ?? ["ar"]).includes("en")
}

/** `path` بلا بادئة اللغة ولا رمز البلد، مثل "/products/abaya" أو "" للرئيسية */
export async function langAlternates(countryCode: string, lang: string, path: string): Promise<NonNullable<Metadata["alternates"]>> {
  const l: Locale = isLocale(lang) ? lang : "ar"
  const at = (x: Locale) => `/${countryCode}${langPrefix(x)}${path}`
  const alt: NonNullable<Metadata["alternates"]> = { canonical: at(l) }
  if (await englishEnabled()) alt.languages = { ar: at("ar"), en: at("en"), "x-default": at("ar") }
  return alt
}

export async function ogLocale(lang: string): Promise<Pick<NonNullable<Metadata["openGraph"]>, "locale" | "alternateLocale">> {
  const l: Locale = isLocale(lang) ? lang : "ar"
  const out: Pick<NonNullable<Metadata["openGraph"]>, "locale" | "alternateLocale"> = { locale: OG_LOCALE[l] }
  if (await englishEnabled()) out.alternateLocale = [OG_LOCALE[l === "ar" ? "en" : "ar"]]
  return out
}

/** لغة المحتوى في JSON-LD (inLanguage) */
export const jsonLdLang = (lang: string) => (lang === "en" ? "en" : "ar")
