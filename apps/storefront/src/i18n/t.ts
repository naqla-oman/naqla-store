import { useLocale, useTranslations } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { storeConfig } from "@/store.config"

/**
 * t مع حقن المخاطبة تلقائياً: الرسائل تستخدم {voice, select, f {…} m {…} other {…}}،
 * والجمع العربي {count, plural, zero {…} one {…} two {…} few {…} many {…} other {…}}.
 */
type Vals = Record<string, string | number | Date | undefined>
export const voiceVal = () => ({ voice: storeConfig.voice === "f" ? "f" : storeConfig.voice === "m" ? "m" : "other" })
// مفتاح يحوي نقطة = مسار كامل من الجذر (common.…) حتى من مترجم بمساحة اسم — تستخدمه الأدوات المشتركة
export function useT(ns?: string) {
  const t = useTranslations(ns), root = useTranslations()
  return (key: string, vals?: Vals) => (ns && key.includes(".") ? root : t)(key, { ...voiceVal(), ...vals })
}
export async function getT(ns?: string) {
  const t = await getTranslations(ns), root = await getTranslations()
  return (key: string, vals?: Vals) => (ns && key.includes(".") ? root : t)(key, { ...voiceVal(), ...vals })
}

/** تسمية العملة حسب اللغة: ر.ع للعربية، ورمز ISO (OMR) للإنجليزية */
export function currencyLabelFor(locale: string) {
  return locale === "ar" ? storeConfig.currencyLabel : storeConfig.currency.toUpperCase()
}
export function useCurrencyLabel() {
  return currencyLabelFor(useLocale())
}
export async function getCurrencyLabel() {
  return currencyLabelFor(await getLocale())
}
