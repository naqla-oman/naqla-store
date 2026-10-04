import { MedusaError } from "@medusajs/framework/utils"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

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
}
export type ClientTier = { key: string; name: string; min: number; perk?: string; group?: string; freeShipping?: boolean; promoCode?: string }
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
  promotions?: { code: string; type: "percentage" | "fixed"; value: number; description?: string }[]
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
  const base = process.env.CLIENTS_DIR ? resolve(process.env.CLIENTS_DIR) : resolve(process.cwd(), "../../clients")
  const dir = join(base, clientSlug())
  if (!existsSync(join(dir, "store.json"))) throw new MedusaError(MedusaError.Types.NOT_FOUND, `لا يوجد ${join(dir, "store.json")} — أنشئي العميل بـ pnpm store:new ${clientSlug()}`)
  return dir
}

let cache: ClientStore | null = null
export function client(): ClientStore {
  if (!cache) cache = JSON.parse(readFileSync(join(clientDir(), "store.json"), "utf-8")) as ClientStore
  return cache
}

/** مفتاح تشغيل ميزة: غير المذكور = مُطفأ */
export const feature = (key: string) => client().features?.[key] === true
