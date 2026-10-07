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

/** رموز Medusa للغات المتجر: الإنجليزية en-US، والعربية ar-SA (لا ar-OM في Medusa) */
export const MEDUSA_LOCALE: Record<string, string> = { en: "en-US", ar: "ar-SA" }

/** لغة السلة عند إنشائها (تنتقل إلى الطلب order.locale) */
export async function medusaCartLocale() {
  try { return MEDUSA_LOCALE[await getLocale()] ?? "ar-SA" } catch { return "ar-SA" }
}

/**
 * ?locale=en-US للطلبات المخزَّنة (مفتاح الذاكرة يختلف بين اللغتين). للعربية لا شيء: الأصل بلا ترجمة.
 * خارج نطاق الطلب (generateStaticParams) يعيد كائناً فارغاً.
 */
export async function localeQuery(): Promise<Record<string, string>> {
  try {
    const l = await getLocale()
    return l === "ar" ? {} : { locale: MEDUSA_LOCALE[l] ?? l }
  } catch { return {} }
}

type TrMap = Record<string, Record<string, string>>
async function fetchTranslations(reference: string): Promise<TrMap> {
  const q = await localeQuery()
  if (!q.locale) return {}
  const base = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  try {
    const r = await fetch(`${base}/store/naqla/translations?reference=${reference}&locale=${q.locale}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 60 },
    })
    if (!r.ok) return {}
    return ((await r.json()) as { translations: TrMap }).translations ?? {}
  } catch { return {} }
}

/**
 * ترجمات لقطات السلة/الطلب (variant_title وproduct_title مخزّنة بالعربية في Medusa):
 * values: id قيمة الخيار ← القيمة المترجمة، products: id المنتج ← العنوان المترجم. للعربية خرائط فارغة.
 */
export async function itemTranslations() {
  const [v, p] = await Promise.all([fetchTranslations("product_option_value"), fetchTranslations("product")])
  const values: Record<string, string> = {}, products: Record<string, string> = {}
  for (const [id, t] of Object.entries(v)) if (t.value) values[id] = t.value
  for (const [id, t] of Object.entries(p)) if (t.title) products[id] = t.title
  return { values, products }
}
/** ترجمات خيارات الشحن: id ← { name } */
export async function shippingOptionTranslations() {
  return fetchTranslations("shipping_option")
}
/** خريطة واحدة id ← نص (قيم الخيارات وعناوين المنتجات) تُمرَّر لمكوّنات العميل (valueMap) */
export async function optionValueTranslations(): Promise<Record<string, string>> {
  const { values, products } = await itemTranslations()
  return { ...values, ...products }
}

/** ترويسة لغة Medusa لطلبات POST (التتبع): x-medusa-locale؛ للعربية لا شيء */
export async function localeHeader(): Promise<Record<string, string>> {
  const q = await localeQuery()
  return q.locale ? { "x-medusa-locale": q.locale } : {}
}

/**
 * لقطات السلة/الطلب (product_title, variant_title, shipping_methods[].name) مخزّنة بالعربية؛
 * بالإنجليزية تُستبدل من الترجمات (ما لا ترجمة له يبقى عربياً). للعربية يُعاد الكائن كما هو.
 * يحتاج *items.variant.options في الحقول المطلوبة.
 */
type Snap = { items?: any[] | null; shipping_methods?: any[] | null } | null | undefined
export async function localizeSnapshots<T extends Snap>(o: T): Promise<T> {
  if (!o) return o
  const q = await localeQuery()
  if (!q.locale) return o
  const [{ values, products }, ship] = await Promise.all([itemTranslations(), shippingOptionTranslations()])
  for (const i of o.items ?? []) {
    const title = i.product_id && products[i.product_id]
    if (title) i.product_title = title
    const opts: any[] = i.variant?.options ?? []
    const vals = opts.map((x) => (x.option_value_id && values[x.option_value_id]) || x.value).filter(Boolean)
    if (vals.length) i.variant_title = vals.join(" / ")
  }
  for (const m of o.shipping_methods ?? []) {
    const name = m.shipping_option_id && ship[m.shipping_option_id]?.name
    if (name) m.name = name
  }
  return o
}
