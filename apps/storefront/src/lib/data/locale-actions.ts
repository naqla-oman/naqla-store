"use server"

import { getLocale as getIntlLocale } from "next-intl/server"
import { MEDUSA_LOCALE } from "@/i18n/t"

/**
 * لغة Medusa للطلب الحالي من لغة الصفحة (x-naqla-lang عبر next-intl)، لا من كوكي:
 * الإنجليزية ← en-US (ترويسة x-medusa-locale على كل طلبات SDK)، والعربية ← null (الأصل بلا ترجمة).
 */
export const getLocale = async (): Promise<string | null> => {
  try {
    const l = await getIntlLocale()
    return l === "ar" ? null : MEDUSA_LOCALE[l] ?? l
  } catch {
    return null
  }
}
