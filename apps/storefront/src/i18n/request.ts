import { headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import ar from "../../messages/ar.json"
import en from "../../messages/en.json"
import { DEFAULT_LOCALE, isLocale } from "./config"

/**
 * next-intl: اللغة من ترويسة يضعها الوسيط (x-naqla-lang) حسب مسار الطلب.
 * الإنجليزية = القاموس العام en + ترجمات العميل (clients/<slug>/locales/en.json) فوق العربية؛
 * أي مفتاح ناقص يعود للعربية، ولا تظهر مفاتيح خام أبداً.
 */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over ?? base) as T
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v
  return out as T
}
let clientEn: Record<string, unknown> | null = null
async function loadClientEn() {
  if (clientEn) return clientEn
  try { clientEn = (await import("@client/locales/en.json")).default as Record<string, unknown> } catch { clientEn = {} }
  return clientEn
}
const lookup = (dict: any, key: string) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict)

export default getRequestConfig(async () => {
  const h = await headers()
  const locale = isLocale(h.get("x-naqla-lang")) ? (h.get("x-naqla-lang") as string) : DEFAULT_LOCALE
  const messages = locale === "ar" ? ar : deepMerge(deepMerge(ar, en), await loadClientEn())
  return {
    locale,
    messages,
    timeZone: "Asia/Muscat",
    onError: () => {},
    getMessageFallback: ({ key, namespace }) => {
      const full = namespace ? `${namespace}.${key}` : key
      const v = lookup(ar, full)
      return typeof v === "string" ? v : ""
    },
  }
})
