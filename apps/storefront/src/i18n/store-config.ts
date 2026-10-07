import { useLocale } from "next-intl"
import { getLocale } from "next-intl/server"
import { storeConfig, type StoreConfig } from "@/store.config"
import raw from "@client/store.json"
import clientEn from "@client-en"

/**
 * نصوص store.json بلغة الصفحة: الإنجليزية = قسم store من clients/<slug>/locales/en.json فوق الإعداد العربي.
 * أي حقل ناقص يبقى بالعربية (لا مفاتيح خام). للعربية يُعاد storeConfig نفسه دون نسخ.
 *
 * المصفوفات: إن كانت كل عناصر الطبقة مُعرَّفة بـ key/id/code تُطابَق بها، وإلا بالترتيب (الفهرس).
 * جذر store.json (location, shipping, returnDays) يقابل storeConfig.seo.*؛ وshipping في seo مُرشَّح بالميزات
 * فتُمنح عناصر الطبقة رموزها (code) من store.json بالفهرس قبل المطابقة.
 */
type AnyObj = Record<string, unknown>
const isObj = (v: unknown): v is AnyObj => !!v && typeof v === "object" && !Array.isArray(v)
const idOf = (v: unknown) => (isObj(v) ? ((v.key ?? v.id ?? v.code) as string | undefined) : undefined)

function overlay<T>(base: T, over: unknown): T {
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

let cache: { key: string; value: StoreConfig } | null = null
function englishOverlay(): AnyObj {
  const en = ((clientEn as AnyObj).store ?? {}) as AnyObj
  const { location, shipping, returnDays, promotions: _p, tags: _t, ...rest } = en as AnyObj & { promotions?: unknown; tags?: unknown }
  const rawShipping = ((raw as AnyObj).shipping ?? []) as AnyObj[]
  const seo: AnyObj = {}
  if (location) seo.location = location
  if (Array.isArray(shipping)) seo.shipping = shipping.map((s, i) => (isObj(s) ? { code: rawShipping[i]?.code, ...s } : s)).filter((s) => isObj(s) && s.code)
  if (returnDays != null) seo.returnDays = returnDays
  return Object.keys(seo).length ? { ...rest, seo } : rest
}

export function localizedStoreConfig(lang: string): StoreConfig {
  if (lang === "ar") return storeConfig
  // storeConfig وكيل (Proxy) يتبع إعدادات اللوحة: نسخة عادية من مفاتيحه ثم الطبقة فوقها
  const plain: AnyObj = {}
  for (const k of Object.keys(storeConfig)) plain[k] = (storeConfig as unknown as AnyObj)[k]
  const key = JSON.stringify(plain)
  if (cache && cache.key === key) return cache.value
  const value = overlay(plain, englishOverlay()) as unknown as StoreConfig
  cache = { key, value }
  return value
}

/** في مكوّنات العميل والخادم المتزامنة */
export function useStoreConfig(): StoreConfig {
  return localizedStoreConfig(useLocale())
}
/** في مكوّنات الخادم غير المتزامنة (async) */
export async function getStoreConfig(): Promise<StoreConfig> {
  try { return localizedStoreConfig(await getLocale()) } catch { return storeConfig }
}
