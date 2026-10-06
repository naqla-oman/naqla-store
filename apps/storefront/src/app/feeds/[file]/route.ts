import { feedItems, FeedItem } from "@lib/feeds/items"
import { getBaseURL } from "@lib/util/env"
import { storeConfig } from "@/store.config"

/**
 * الكتالوجات: /feeds/google.xml (Merchant Center)، /feeds/meta.csv (Meta + كتالوج واتساب)،
 * /feeds/snap.csv، /feeds/tiktok.csv — من Medusa مباشرة، تُعاد كل ساعة.
 */
export const revalidate = 3600

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
// منخفضة: خلية تبدأ بـ = + - @ أو Tab/CR تُفتح صيغةً في Excel — تُسبَق بـ ' (نص). الأرقام تبقى كما هي.
const csvCell = (s: string | number) => {
  let v = String(s ?? "")
  if (typeof s !== "number" && /^[=+\-@\t\r]/.test(v)) v = "'" + v
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function google(items: FeedItem[]) {
  const ship = storeConfig.seo.shipping.find((s) => s.code === "standard")
  const country = storeConfig.seo.country.toUpperCase()
  const entries = items.map((i) => `    <item>
      <g:id>${xml(i.id)}</g:id>
      <g:item_group_id>${xml(i.item_group_id)}</g:item_group_id>
      <title>${xml(i.title)}</title>
      <description>${xml(i.description)}</description>
      <link>${xml(i.link)}</link>
      <g:image_link>${xml(i.image_link)}</g:image_link>
${i.additional_image_links.map((u) => `      <g:additional_image_link>${xml(u)}</g:additional_image_link>`).join("\n")}
      <g:availability>${i.availability}</g:availability>
      <g:price>${i.price}</g:price>${i.sale_price ? `\n      <g:sale_price>${i.sale_price}</g:sale_price>` : ""}
      <g:brand>${xml(i.brand)}</g:brand>
      <g:condition>${i.condition}</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${xml(i.product_type)}</g:product_type>${i.size ? `\n      <g:size>${xml(i.size)}</g:size>` : ""}${i.color ? `\n      <g:color>${xml(i.color)}</g:color>` : ""}${ship ? `
      <g:shipping>
        <g:country>${country}</g:country>
        <g:service>${xml(ship.name)}</g:service>
        <g:price>${ship.amount.toFixed(3)} ${storeConfig.currency.toUpperCase()}</g:price>
      </g:shipping>` : ""}
    </item>`).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(storeConfig.name)}</title>
    <link>${xml(getBaseURL())}</link>
    <description>${xml(storeConfig.description)}</description>
${entries}
  </channel>
</rss>
`
}

// أعمدة كل منصة (الأول معرّف المنتج بحسب تسميتها)
const COLUMNS: Record<string, [string, (i: FeedItem) => string | number][]> = {
  meta: [
    ["id", (i) => i.id], ["item_group_id", (i) => i.item_group_id], ["title", (i) => i.title], ["description", (i) => i.description],
    ["availability", (i) => i.availability], ["condition", (i) => i.condition], ["price", (i) => i.price], ["sale_price", (i) => i.sale_price],
    ["link", (i) => i.link], ["image_link", (i) => i.image_link], ["additional_image_link", (i) => i.additional_image_links.join(",")],
    ["brand", (i) => i.brand], ["product_type", (i) => i.product_type], ["size", (i) => i.size], ["color", (i) => i.color], ["quantity_to_sell_on_facebook", (i) => i.inventory],
  ],
  snap: [
    ["id", (i) => i.id], ["item_group_id", (i) => i.item_group_id], ["title", (i) => i.title], ["description", (i) => i.description],
    ["link", (i) => i.link], ["image_link", (i) => i.image_link], ["additional_image_link", (i) => i.additional_image_links.join(",")],
    ["availability", (i) => i.availability], ["price", (i) => i.price], ["sale_price", (i) => i.sale_price], ["brand", (i) => i.brand],
    ["condition", (i) => i.condition], ["product_type", (i) => i.product_type], ["size", (i) => i.size], ["color", (i) => i.color],
  ],
  tiktok: [
    ["sku_id", (i) => i.id], ["item_group_id", (i) => i.item_group_id], ["title", (i) => i.title], ["description", (i) => i.description],
    ["availability", (i) => i.availability], ["condition", (i) => i.condition], ["price", (i) => i.price], ["sale_price", (i) => i.sale_price],
    ["link", (i) => i.link], ["image_link", (i) => i.image_link], ["additional_image_link", (i) => i.additional_image_links.join(",")],
    ["brand", (i) => i.brand], ["product_type", (i) => i.product_type], ["size", (i) => i.size], ["color", (i) => i.color], ["inventory", (i) => i.inventory],
  ],
}
const csv = (items: FeedItem[], cols: (typeof COLUMNS)[string]) =>
  // BOM حتى تقرأ Excel والمنصات النص العربي بترميز UTF-8
  "\uFEFF" + [cols.map(([h]) => h).join(","), ...items.map((i) => cols.map(([, f]) => csvCell(f(i))).join(","))].join("\n") + "\n"

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const items = await feedItems()
  if (file === "google.xml") return new Response(google(items), { headers: { "Content-Type": "application/xml; charset=utf-8" } })
  const m = file.match(/^(meta|snap|tiktok)\.csv$/)
  if (m) return new Response(csv(items, COLUMNS[m[1]]), { headers: { "Content-Type": "text/csv; charset=utf-8" } })
  return new Response("Not found", { status: 404 })
}
