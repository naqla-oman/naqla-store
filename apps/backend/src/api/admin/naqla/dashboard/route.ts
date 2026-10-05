import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { client } from "../../../../lib/client"
import { orderNumber } from "../../../../lib/store-data"

/**
 * GET /admin/naqla/dashboard — مؤشرات الصفحة الرئيسية للوحة نقلة.
 * الأيام بتوقيت المتجر (Asia/Muscat)، والطلبات الملغاة خارج المبيعات.
 */
const TZ = "Asia/Muscat"
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) // YYYY-MM-DD
const CLICK: [string, string][] = [["gclid", "إعلانات Google"], ["fbclid", "Meta"], ["ScCid", "سناب شات"], ["ttclid", "تيك توك"]]

function sourceOf(meta: any): string {
  const v = meta?.attribution?.last ?? meta?.attribution?.first
  if (!v) return "مباشر"
  if (v.utm_source) return String(v.utm_source)
  const click = CLICK.find(([k]) => v[k])
  return click ? click[1] : v.ref ? String(v.ref) : "مباشر"
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const store = client() as any
  const now = new Date()
  const today = dayKey(now)
  const month = today.slice(0, 7)
  const since = new Date(now.getTime() - 35 * 86400000)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "status", "total", "created_at", "currency_code", "metadata",
      "is_draft_order", "shipping_address.province", "shipping_address.first_name", "fulfillments.id", "fulfillments.canceled_at",
      "items.product_id", "items.product_title", "items.quantity", "items.unit_price"],
    filters: { created_at: { $gte: since } } as any,
    pagination: { take: 5000, order: { created_at: "DESC" } },
  })

  // H15: المسودات ليست مبيعات
  const real = (o: any) => o.status !== "canceled" && o.status !== "draft" && !o.is_draft_order
  const live = (orders as any[]).filter(real)
  // H14: تنفيذ ملغى ليس تنفيذاً
  const fulfilled = (o: any) => (o.fulfillments ?? []).some((f: any) => !f.canceled_at)
  const sum = (list: any[]) => list.reduce((s, o) => s + Number(o.total || 0), 0)
  const todays = live.filter((o) => dayKey(new Date(o.created_at)) === today)
  const months = live.filter((o) => dayKey(new Date(o.created_at)).startsWith(month))
  const last30 = live.filter((o) => now.getTime() - new Date(o.created_at).getTime() <= 30 * 86400000)

  // بانتظار التجهيز: لا تنفيذ بعد
  // H14: بانتظار التجهيز بلا قيد تاريخ (طلب أقدم من 35 يوماً لم يُجهَّز يبقى ظاهراً) وباستبعاد التنفيذ الملغى
  const { data: openOrders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "status", "total", "created_at", "is_draft_order", "shipping_address.first_name", "fulfillments.id", "fulfillments.canceled_at"],
    filters: { status: { $nin: ["canceled", "draft", "completed", "archived"] } } as any,
    pagination: { take: 2000, order: { created_at: "ASC" } },
  })
  const pending = (openOrders as any[]).filter((o) => real(o) && !fulfilled(o))

  // أفضل المنتجات (30 يوماً) بالكمية ثم الإيراد — الخدمات (التفصيل) ضمنها لأنها مبيعات فعلية
  const products = new Map<string, { title: string; quantity: number; revenue: number }>()
  for (const o of last30) for (const i of o.items ?? []) {
    const p = products.get(i.product_id) ?? { title: i.product_title, quantity: 0, revenue: 0 }
    p.quantity += Number(i.quantity); p.revenue += Number(i.unit_price) * Number(i.quantity)
    products.set(i.product_id, p)
  }

  // حسب المحافظة والمصدر (30 يوماً)
  const govName = (code?: string) => store.checkout?.governorates?.find((g: any) => g.code === code)?.name ?? code ?? "غير محدد"
  const group = (key: (o: any) => string) => {
    const m = new Map<string, { orders: number; total: number }>()
    for (const o of last30) {
      const k = key(o); const g = m.get(k) ?? { orders: 0, total: 0 }
      g.orders++; g.total += Number(o.total || 0); m.set(k, g)
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)
  }

  // المخزون المنخفض: المتاح (المخزّن − المحجوز) ≤ حد العميل، للمتغيّرات المُدار مخزونها
  const low = Number(store.product?.lowStockAt ?? 3)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "sku", "manage_inventory", "product.id", "product.title", "product.metadata",
      "inventory_items.inventory.location_levels.stocked_quantity", "inventory_items.inventory.location_levels.reserved_quantity"],
    pagination: { take: 5000 },
  })
  const lowStock = (variants as any[])
    .filter((v) => v.manage_inventory && !v.product?.metadata?.service)
    .map((v) => {
      const levels = (v.inventory_items ?? []).flatMap((ii: any) => ii.inventory?.location_levels ?? [])
      const available = levels.reduce((s: number, l: any) => s + Number(l.stocked_quantity || 0) - Number(l.reserved_quantity || 0), 0)
      return { id: v.id, product_id: v.product?.id, product: v.product?.title, variant: v.title, sku: v.sku, available }
    })
    .filter((v) => v.available <= low)
    .sort((a, b) => a.available - b.available)

  res.json({
    currency: store.currency,
    currencyLabel: store.currencyLabel ?? store.currency?.toUpperCase(),
    store: { name: store.name },
    today: { sales: sum(todays), orders: todays.length },
    month: { sales: sum(months), orders: months.length, average: months.length ? sum(months) / months.length : 0 },
    pending: {
      count: pending.length,
      orders: pending.slice(0, 6).map((o) => ({ id: o.id, number: orderNumber(o.display_id), total: Number(o.total), name: o.shipping_address?.first_name ?? "", created_at: o.created_at })),
    },
    lowStock: { threshold: low, count: lowStock.length, items: lowStock.slice(0, 8) },
    topProducts: [...products.entries()].map(([id, p]) => ({ id, ...p })).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 6),
    byGovernorate: group((o) => govName(o.shipping_address?.province)).slice(0, 11),
    bySource: group((o) => sourceOf(o.metadata)).slice(0, 8),
  })
}
