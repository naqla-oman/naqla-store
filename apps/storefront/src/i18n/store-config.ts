import { useLocale } from "next-intl"
import { getLocale } from "next-intl/server"
import { buildFrom, storeConfig, type StoreConfig } from "@/store.config"
import clientEn from "@client-en"

/**
 * نصوص store.json بلغة الصفحة: الإنجليزية = قسم store من clients/<slug>/locales/en.json فوق الإعداد العربي.
 * أي حقل ناقص يبقى بالعربية (لا مفاتيح خام). للعربية يُعاد storeConfig نفسه دون نسخ.
 *
 * المصفوفات: إن كانت كل عناصر الطبقة مُعرَّفة بـ key/id/code تُطابَق بها، وإلا بالترتيب (الفهرس).
 * الطبقة بشكل store.json نفسه (قسم store في locales/en.json) وتُطبَّق قبل البناء.
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
export function localizedStoreConfig(lang: string): StoreConfig {
  if (lang === "ar") return storeConfig
  // الطبقة تُطبَّق على store.json الفعلي (مع إعدادات اللوحة) ثم يُبنى الإعداد كاملاً، فتتبعها الحقول المشتقة
  // (freeShippingTier، tierPerks، shipping المُرشَّح…) بلا معالجة خاصة
  const en = ((clientEn as AnyObj).store ?? {}) as AnyObj
  const { promotions: _p, tags: _t, ...layer } = en as AnyObj & { promotions?: unknown; tags?: unknown }
  const built = buildFrom((c) => overlay(c as unknown as AnyObj, layer) as unknown as typeof c)
  if (cache && cache.key === built.key) return cache.value
  cache = { key: built.key, value: built.value }
  return built.value
}

/** في مكوّنات العميل والخادم المتزامنة */
export function useStoreConfig(): StoreConfig {
  return localizedStoreConfig(useLocale())
}
/** في مكوّنات الخادم غير المتزامنة (async) */
export async function getStoreConfig(): Promise<StoreConfig> {
  try { return localizedStoreConfig(await getLocale()) } catch { return storeConfig }
}
