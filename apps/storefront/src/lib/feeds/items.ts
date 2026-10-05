import "server-only"
import { sdk } from "@lib/config"
import { getBaseURL } from "@lib/util/env"
import { availableQty } from "@modules/products/lib/variants"
import { HttpTypes } from "@medusajs/types"
import { storeConfig } from "../../store.config"

/**
 * عناصر الكتالوج: عنصر لكل متغيّر (مقاس/لون/حجم)، يجمعها item_group_id للمنتج.
 * المصدر Medusa مباشرة (أسعار المنطقة شاملة الضريبة + المخزون)، فالكتالوجات تتحدث تلقائياً.
 */
export type FeedItem = {
  id: string
  item_group_id: string
  title: string
  description: string
  link: string
  image_link: string
  additional_image_links: string[]
  availability: "in stock" | "out of stock"
  inventory: number
  price: string
  sale_price: string
  brand: string
  condition: "new"
  product_type: string
  size: string
  color: string
}

const money = (n: number) => `${n.toFixed(3)} ${storeConfig.currency.toUpperCase()}`
const clean = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim()

export async function feedItems(): Promise<FeedItem[]> {
  const base = getBaseURL()
  const cc = process.env.NEXT_PUBLIC_DEFAULT_REGION || "om"
  const { regions } = await sdk.client.fetch<{ regions: HttpTypes.StoreRegion[] }>("/store/regions", { cache: "no-store" })
  const region = regions.find((r) => r.countries?.some((c) => c.iso_2 === cc)) ?? regions[0]
  const products: HttpTypes.StoreProduct[] = []
  for (let offset = 0; offset < 10000; offset += 100) {
    const r = await sdk.client.fetch<{ products: HttpTypes.StoreProduct[] }>("/store/products", {
      query: {
        limit: 100, offset, region_id: region.id,
        fields: "*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder,*variants.options,+variants.metadata,*options,*images,*categories,+metadata",
      },
      cache: "no-store",
    })
    products.push(...r.products)
    if (r.products.length < 100) break
  }
  const colorTitle = storeConfig.options.find((o) => o.type === "color")?.title
  const sizeTitle = storeConfig.options.find((o) => o.type !== "color")?.title

  return products
    .filter((p) => !(p.metadata as any)?.service)
    .flatMap((p) => {
      const images = (p.images ?? []).map((i) => i.url)
      const val = (v: HttpTypes.StoreProductVariant, title?: string) => {
        const opt = (p.options ?? []).find((o) => o.title === title)
        return opt ? v.options?.find((x) => x.option_id === opt.id)?.value ?? "" : ""
      }
      const multi = (p.variants ?? []).length > 1
      return (p.variants ?? []).map((v) => {
        const cp = v.calculated_price
        const price = cp?.calculated_amount ?? 0
        const old = Math.max(cp?.original_amount ?? 0, Number((v.metadata as any)?.compare_at_price ?? (p.metadata as any)?.compare_at_price) || 0)
        const qty = availableQty(v)
        return {
          // معرّف المتغيّر (لاتيني، variant_…): هو نفسه content_ids في البكسلات وأحداث الخادم،
          // فتطابق Meta/TikTok/Snap الإعلانات الديناميكية بالكتالوج (الـSKU قد يحوي نصاً عربياً)
          id: v.id,
          item_group_id: p.handle!,
          title: clean(multi ? `${p.title} — ${v.title}` : p.title).slice(0, 150),
          description: clean(p.description || p.title).slice(0, 5000),
          link: `${base}/${cc}/products/${p.handle}?v_id=${v.id}`,
          image_link: images[0] ?? "",
          additional_image_links: images.slice(1, 10),
          availability: qty > 0 ? "in stock" : "out of stock",
          inventory: Math.min(qty, 999),
          // سعر قبل الخصم في price والسعر الحالي في sale_price عند وجود تخفيض (قاعدة Google/Meta)
          price: money(old > price ? old : price),
          sale_price: old > price ? money(price) : "",
          brand: storeConfig.name,
          condition: "new",
          product_type: clean(p.categories?.[0]?.name),
          size: val(v, sizeTitle),
          color: val(v, colorTitle),
        } satisfies FeedItem
      })
    })
}
