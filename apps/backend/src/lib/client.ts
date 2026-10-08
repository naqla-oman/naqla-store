import { MedusaError } from "@medusajs/framework/utils"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { CLIENTS_DIR } from "./paths"
import { detectFont, detectPalette } from "./themes"

/**
 * بيانات العميل من clients/<STORE>/store.json — المصدر الوحيد لكل ما يخص المتجر.
 * لا توجد قيمة افتراضية: تشغيل الخادم أو البذرة بلا STORE خطأ صريح.
 */

export type ClientOption = { key: string; title: string; type: "buttons" | "color"; swatches?: Record<string, [string, string]> }
export type ClientProduct = {
  handle: string
  title: string
  category: string
  collection?: string | null
  description: string
  price: number
  compare_at?: number | null
  images: string[]
  /** قيم كل خيار من store.options، مثل { size: ["S","M"], color: ["أسود"] } */
  options: Record<string, string[]>
  /** مخزون حسب قيمة الخيار الأول (أو "default") */
  stock?: Record<string, number>
  /** سعر مختلف حسب قيمة الخيار الأول (مثل 50 مل / 100 مل) — وإلا price */
  prices?: Record<string, number>
  tags?: string[]
  rating?: number
  reviews?: number
  sold_week?: number
  complements?: string[]
  /** اسم لاتيني اختياري يُعرض تحت اسم المنتج (fonts.latin) */
  title_en?: string
  /** رمز المخزون من المتجر السابق (store:import) — للمنتج بمتغيّر واحد، وإلا يُولَّد */
  sku?: string
}
export type ClientTier = { key: string; name: string; min: number; perk?: string; group?: string; freeShipping?: boolean; promoCode?: string; tailoringDiscount?: number }
export type ClientShipping = { code: string; name: string; desc: string; amount: number; free_over?: number; provinces?: string[] }
export type ClientStore = {
  slug: string
  name: string
  nameEn: string
  shortName: string
  country: string
  currency: string
  vatRate: number
  orderPrefix: string
  features: Record<string, boolean>
  options: ClientOption[]
  loyalty: { pointsPerUnit: number; redeemPoints: number; redeemValue: number; tiers: ClientTier[] }
  location: { name: string; city: string; address: string }
  shipping: ClientShipping[]
  /** firstOrderOnly: لأول طلب فقط (حساب/بريد/هاتف) — exclusive: لا يُجمع مع أكواد أخرى — limit: حد الاستخدام الكلي */
  /** M13: آخر ساعة للتوصيل السريع «اليوم» (بتوقيت المتجر) وأيام بلا توصيل سريع (0=الأحد … 5=الجمعة) */
  cutoffHour?: number
  deliveryOffDays?: number[]
  /** M18: المحافظات وولاياتها (قائمة الدفع والتحقق على الخادم) */
  checkout?: { governorates?: { code: string; name: string; wilayats?: string[] }[] } & Record<string, any>
  /** M21: أوزان الشحن بالجرام — لكل قسم، وافتراضي؛ والمنتج يتجاوزها بـ weight */
  shippingWeights?: { default?: number; categories?: Record<string, number> }
  promotions?: { code: string; type: "percentage" | "fixed"; value: number; description?: string; firstOrderOnly?: boolean; exclusive?: boolean; limit?: number }[]
  categories: { handle: string; name: string }[]
  collections: { handle: string; title: string }[]
  tags: { value: string; label: string }[]
  products: ClientProduct[]
  [k: string]: unknown
}

export function clientSlug(): string {
  const slug = process.env.STORE?.trim()
  if (!slug) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "STORE غير محدد — حدّد العميل في .env (مثال: STORE=<slug>). المجلد المطلوب: clients/<STORE>/")
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `STORE غير صالح: «${slug}» (حروف لاتينية صغيرة وأرقام وشرطات فقط)`)
  return slug
}

/** مجلد العميل: CLIENTS_DIR (للحاويات) أو clients/ في جذر المستودع */
export function clientDir(): string {
  // C8: من الجذر الثابت لا من مجلد التشغيل
  const dir = join(CLIENTS_DIR, clientSlug())
  if (!existsSync(join(dir, "store.json"))) throw new MedusaError(MedusaError.Types.NOT_FOUND, `لا يوجد ${join(dir, "store.json")} — أنشئي العميل بـ pnpm store:new ${clientSlug()}`)
  return dir
}

let cache: ClientStore | null = null
/** إعدادات المتجر من القاعدة (وحدة store-settings) — تستبدل قيم store.json الافتراضية */
let overrides: Record<string, unknown> = {}
let merged: ClientStore | null = null

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
/** دمج عميق: الكائنات تُدمج، والمصفوفات والقيم البسيطة تُستبدل */
export function deepMerge<T>(base: T, over: Record<string, unknown>): T {
  if (!isObj(base)) return base
  const out: Record<string, unknown> = { ...(base as any) }
  for (const [k, v] of Object.entries(over ?? {})) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v
  return out as T
}

/** القيم الافتراضية كما في store.json (بلا تعديلات اللوحة) */
export function clientDefaults(): ClientStore {
  if (!cache) {
    cache = JSON.parse(readFileSync(join(clientDir(), "store.json"), "utf-8")) as ClientStore
    // كتالوج مستورد (pnpm store:import) في ملف مستقل حتى لا يدخل حزمة الواجهة مع store.json — يُضاف إلى ما في store.json
    const catalog = join(clientDir(), "catalog.json")
    if (existsSync(catalog)) {
      const cat = JSON.parse(readFileSync(catalog, "utf-8")) as Partial<Pick<ClientStore, "categories" | "collections" | "tags" | "products">>
      for (const k of ["categories", "collections", "tags", "products"] as const) {
        if (cat[k]?.length) (cache as any)[k] = [...((cache as any)[k] ?? []), ...cat[k]!]
      }
    }
    // الهوية الافتراضية: اللوحة والخط المطابقان لملفات العميل (أو custom) — تبويب «الهوية»
    // (استيراد دائري آمن مع themes.ts: الدوال تُستدعى بعد اكتمال التحميل)
    ;(cache as any).theme = { palette: detectPalette(), font: detectFont((cache as any).fonts), ...((cache as any).theme ?? {}) }
  }
  return cache
}

/** القيمة الفعلية = store.json تستبدلها إعدادات اللوحة */
export function client(): ClientStore {
  if (!merged) merged = deepMerge(clientDefaults(), overrides)
  return merged
}

export function setClientOverrides(o: Record<string, unknown> | null | undefined) {
  overrides = o ?? {}
  merged = null
}

/** مفتاح تشغيل ميزة: غير المذكور = مُطفأ */
export const feature = (key: string) => client().features?.[key] === true
