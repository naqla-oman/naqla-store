import { useLocale, useTranslations } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { storeConfig } from "@/store.config"

/**
 * t مع حقن المخاطبة تلقائياً: الرسائل تستخدم {voice, select, f {…} m {…} other {…}}،
 * والجمع العربي {count, plural, zero {…} one {…} two {…} few {…} many {…} other {…}}.
 */
type Vals = Record<string, string | number | Date | undefined>
export const voiceVal = () => ({ voice: storeConfig.voice === "f" ? "f" : storeConfig.voice === "m" ? "m" : "other" })
export function useT(ns?: string) {
  const t = useTranslations(ns)
  return (key: string, vals?: Vals) => t(key, { ...voiceVal(), ...vals })
}
export async function getT(ns?: string) {
  const t = await getTranslations(ns)
  return (key: string, vals?: Vals) => t(key, { ...voiceVal(), ...vals })
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
