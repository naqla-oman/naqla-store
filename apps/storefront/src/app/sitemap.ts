import type { MetadataRoute } from "next"
import { sdk } from "@lib/config"
import { getBaseURL } from "@lib/util/env"
import { PAGES, readPage } from "@lib/pages/content"
import { ensureStoreSettings } from "@lib/data/store-settings"
import { storeConfig } from "@/store.config"

/**
 * sitemap.xml ديناميكي من Medusa: الصفحة الرئيسية والمتجر، المنتجات، الأقسام، المجموعات.
 * يُعاد بناؤه كل ساعة، فأي منتج يُضاف أو يُعدَّل يظهر تلقائياً. خدمات (metadata.service) مستبعدة.
 * المرحلة 3: مع الإنجليزية مفعّلة يُدرَج كل رابط باللغتين، ولكل مدخل alternates.languages (hreflang في sitemap)؛
 * متجر بلغة واحدة = الروابط العربية فقط.
 */
export const revalidate = 3600

type Row = { handle: string; updated_at?: string; metadata?: Record<string, unknown> | null }

async function all(path: string, key: string, fields: string): Promise<Row[]> {
  const out: Row[] = []
  for (let offset = 0; offset < 10000; offset += 200) {
    const r = await sdk.client.fetch<Record<string, any>>(path, { query: { limit: 200, offset, fields }, cache: "no-store" }).catch(() => null)
    const rows = (r?.[key] ?? []) as Row[]
    out.push(...rows)
    if (rows.length < 200) break
  }
  return out
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureStoreSettings()
  const base = getBaseURL()
  const cc = process.env.NEXT_PUBLIC_DEFAULT_REGION || "om"
  const en = (storeConfig.languages ?? ["ar"]).includes("en")
  const [products, categories, collections] = await Promise.all([
    all("/store/products", "products", "handle,updated_at,+metadata"),
    all("/store/product-categories", "product_categories", "handle,updated_at"),
    all("/store/collections", "collections", "handle,updated_at"),
  ])
  const at = (d?: string) => (d ? new Date(d) : undefined)
  type Entry = { path: string; lastModified?: Date; changeFrequency: "daily" | "weekly" | "monthly"; priority: number; enOnlyIf?: boolean }
  const entries: Entry[] = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/store", changeFrequency: "daily", priority: 0.8 },
    // H12: صفحات السياسات والمعلومات الموجودة لهذا المتجر (الإنجليزية إن وُجد <page>.en.md أو العربية احتياطاً)
    ...PAGES.filter((p) => readPage(p)).map((p) => ({ path: `/pages/${p}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...categories.map((c) => ({ path: `/categories/${c.handle}`, lastModified: at(c.updated_at), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((c) => ({ path: `/collections/${c.handle}`, lastModified: at(c.updated_at), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.filter((p) => !p.metadata?.service).map((p) => ({ path: `/products/${p.handle}`, lastModified: at(p.updated_at), changeFrequency: "weekly" as const, priority: 0.9 })),
  ]
  const ar = (p: string) => `${base}/${cc}${p}`, enUrl = (p: string) => `${base}/${cc}/en${p}`
  return entries.flatMap(({ path, ...e }) => {
    if (!en) return [{ url: ar(path), ...e }]
    const languages = { ar: ar(path), en: enUrl(path), "x-default": ar(path) }
    return [
      { url: ar(path), ...e, alternates: { languages } },
      { url: enUrl(path), ...e, alternates: { languages } },
    ]
  })
}
