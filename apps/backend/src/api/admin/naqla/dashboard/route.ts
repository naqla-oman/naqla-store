import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { adminLang, clientIn, currencyLabelIn } from "../../../../lib/admin-i18n"
import { client } from "../../../../lib/client"
import { memo } from "../../../../lib/memo"
import { orderNumber } from "../../../../lib/store-data"
import { medusaLocale, readTranslations } from "../../../../lib/translations"

/**
 * GET /admin/naqla/dashboard — مؤشرات الصفحة الرئيسية للوحة نقلة.
 * الأيام بتوقيت المتجر (Asia/Muscat)، والطلبات الملغاة خارج المبيعات.
 * المرحلة 5: الأرقام تُحسب مرة (ذاكرة 60 ث) والأسماء بلغة اللوحة (x-naqla-lang): المحافظات من طبقة en،
 * والمنتجات وقيم المتغيّرات من وحدة الترجمة (الناقص يبقى عربياً)، والمصادر المعروفة رموز «~…» تترجمها اللوحة.
 */
const TZ = "Asia/Muscat"
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) // YYYY-MM-DD
const CLICK: [string, string][] = [["gclid", "~google_ads"], ["fbclid", "~meta"], ["ScCid", "~snapchat"], ["ttclid", "~tiktok"]]

/** مرجع منطق المصدر (يُكرَّر في SQL أدناه بنفس الترتيب) */
export function sourceOf(meta: any): string {
  const v = meta?.attribution?.last ?? meta?.attribution?.first
  if (!v) return "~direct"
  if (v.utm_source) return String(v.utm_source)
  const click = CLICK.find(([k]) => v[k])
  return click ? click[1] : v.ref ? String(v.ref) : "~direct"
}

/**
 * M31: SQL مجمّع بدل تحميل آلاف الطلبات والمتغيّرات في الذاكرة، مع ذاكرة 60 ثانية.
 * المجموع من order_summary.totals.current_order_total للإصدار الحالي (مطابق لـ total في Medusa).
 */
const BASE = `
  select o.id, o.display_id, o.status, o.created_at, o.metadata,
         (s.totals->>'current_order_total')::numeric as total,
         a.province, a.first_name,
         exists (select 1 from order_fulfillment ofl join fulfillment f on f.id = ofl.fulfillment_id
                  where ofl.order_id = o.id and ofl.deleted_at is null and f.deleted_at is null and f.canceled_at is null) as fulfilled
    from "order" o
    join order_summary s on s.order_id = o.id and s.version = o.version and s.deleted_at is null
    left join order_address a on a.id = o.shipping_address_id
   where o.deleted_at is null and o.status not in ('canceled', 'draft') and o.is_draft_order = false`
// عامل وجود المفتاح «?» في jsonb يعدّه knex علامة ربط ← ->> is not null (مكافئ)
const SOURCE = `coalesce(
    attr->>'utm_source',
    case when attr->>'gclid' is not null then '~google_ads' when attr->>'fbclid' is not null then '~meta' when attr->>'ScCid' is not null then '~snapchat' when attr->>'ttclid' is not null then '~tiktok' end,
    attr->>'ref', '~direct')`

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const store = client() as any
  const lang = adminLang(req)
  const raw = await memo(`dashboard:${store.slug}`, 60_000, async () => {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = async (sql: string, b: any[] = []) => (await pg.raw(sql, b as any)).rows as any[]
    const today = dayKey(new Date())
    const month = today.slice(0, 7)
    // قيم نحسبها بأنفسنا بصيغة ثابتة (لا مدخلات مستخدم) — تُضمَّن بعد التحقق: knex لا يتعرّف على ? الملاصقة لـ ::
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "bad day key")
    const day = `(created_at at time zone '${TZ}')::date`

    const [k] = await rows(`with o as (${BASE}) select
        coalesce(sum(total) filter (where ${day} = '${today}'::date), 0) as today_sales, count(*) filter (where ${day} = '${today}'::date) as today_orders,
        coalesce(sum(total) filter (where to_char(${day}, 'YYYY-MM') = '${month}'), 0) as month_sales, count(*) filter (where to_char(${day}, 'YYYY-MM') = '${month}') as month_orders
      from o`)

    // H14: بانتظار التجهيز بلا قيد تاريخ، باستبعاد التنفيذ الملغى
    const pendingRows = await rows(`with o as (${BASE}) select id, display_id, total, first_name, created_at, count(*) over () as n
      from o where status not in ('completed', 'archived') and not fulfilled order by created_at asc limit 6`)

    const last30 = `created_at >= now() - interval '30 days'`
    // الاسم من المنتج نفسه (العربي) لا من لقطة السطر — اللقطة بلغة لحظة الطلب (طلب إنجليزي ← اسم إنجليزي)
    const top = await rows(`select li.product_id as id, coalesce(max(p.title), max(li.product_title)) as title, sum(oi.quantity)::numeric as quantity, sum(li.unit_price * oi.quantity)::numeric as revenue
      from (${BASE}) o
      join "order" ord on ord.id = o.id
      join order_item oi on oi.order_id = o.id and oi.version = ord.version and oi.deleted_at is null
      join order_line_item li on li.id = oi.item_id and li.deleted_at is null
      left join product p on p.id = li.product_id
      where o.${last30} group by li.product_id order by 3 desc, 4 desc limit 6`)
    const byGov = await rows(`with o as (${BASE}) select province as code, count(*) as orders, coalesce(sum(total), 0) as total
      from o where ${last30} group by province order by 3 desc limit 11`)
    const bySource = await rows(`with o as (${BASE}), x as (select total, coalesce(metadata->'attribution'->'last', metadata->'attribution'->'first') as attr from o where ${last30})
      select ${SOURCE} as name, count(*) as orders, coalesce(sum(total), 0) as total from x group by 1 order by 3 desc limit 8`)

    // المخزون المنخفض: المتاح (المخزّن − المحجوز) ≤ حد العميل، للمتغيّرات المُدار مخزونها (بلا منتجات الخدمة)
    const low = Math.max(0, Math.trunc(Number(store.product?.lowStockAt ?? 3)) || 0)
    const lowRows = await rows(`select v.id, v.title as variant, v.sku, p.id as product_id, p.title as product,
          coalesce(sum(l.stocked_quantity - l.reserved_quantity), 0)::numeric as available, count(*) over () as n
        from product_variant v
        join product p on p.id = v.product_id and p.deleted_at is null and p.status = 'published' and coalesce(p.metadata->>'service', 'false') <> 'true' -- منخفضة: لا مسودات
        left join product_variant_inventory_item pvi on pvi.variant_id = v.id and pvi.deleted_at is null
        left join inventory_level l on l.inventory_item_id = pvi.inventory_item_id and l.deleted_at is null
       where v.deleted_at is null and v.manage_inventory = true
       group by v.id, p.id having coalesce(sum(l.stocked_quantity - l.reserved_quantity), 0) <= ${low}
       order by available asc, p.title asc, v.title asc limit 8`) // ترتيب ثابت بين المتساوين

    // قيم المتغيّرات (لترجمة عنوان المتغيّر «50 / أسود» جزءاً جزءاً — قرار 23)
    const optRows = lowRows.length ? await rows(`select pvo.variant_id, pov.id, pov.value from product_variant_option pvo
        join product_option_value pov on pov.id = pvo.option_value_id and pov.deleted_at is null
       where pvo.variant_id in (${lowRows.map(() => "?").join(", ")})`, lowRows.map((v) => v.id)) : []
    const n = (v: any) => Number(v ?? 0)
    return {
      currency: store.currency,
      optionValues: optRows.map((o) => ({ variant: o.variant_id as string, id: o.id as string, value: o.value as string })),
      today: { sales: n(k.today_sales), orders: n(k.today_orders) },
      month: { sales: n(k.month_sales), orders: n(k.month_orders), average: n(k.month_orders) ? n(k.month_sales) / n(k.month_orders) : 0 },
      pending: {
        count: n(pendingRows[0]?.n),
        orders: pendingRows.map((o) => ({ id: o.id, number: orderNumber(o.display_id), total: n(o.total), name: o.first_name ?? "", created_at: o.created_at })),
      },
      lowStock: { threshold: low, count: n(lowRows[0]?.n), items: lowRows.map((v) => ({ id: v.id, product_id: v.product_id, product: v.product, variant: v.variant, sku: v.sku, available: n(v.available) })) },
      topProducts: top.map((p) => ({ id: p.id, title: p.title, quantity: n(p.quantity), revenue: n(p.revenue) })),
      byGovernorate: byGov.map((g) => ({ code: (g.code ?? null) as string | null, orders: n(g.orders), total: n(g.total) })),
      bySource: bySource.map((g) => ({ name: g.name, orders: n(g.orders), total: n(g.total) })),
    }
  })
  // الأسماء بلغة اللوحة (خارج الذاكرة: نفس الأرقام للغتين)
  const c = clientIn(lang) as any
  const govName = (code: string | null) => c.checkout?.governorates?.find((g: any) => g.code === code)?.name ?? code ?? "~unknown"
  let titles = new Map<string, Record<string, string>>(), values = new Map<string, Record<string, string>>()
  if (lang !== "ar") {
    const locale = medusaLocale(lang)
    const ids = [...new Set([...raw.topProducts.map((p) => p.id), ...raw.lowStock.items.map((v) => v.product_id)])]
    ;[titles, values] = await Promise.all([
      readTranslations(req.scope, "product", locale, { ids, fields: ["title"] }),
      readTranslations(req.scope, "product_option_value", locale, { ids: raw.optionValues.map((o) => o.id), fields: ["value"] }),
    ])
  }
  const title = (id: string, fallback: string) => titles.get(id)?.title || fallback
  const variantTitle = (id: string, t: string) => {
    const own = raw.optionValues.filter((o) => o.variant === id)
    return String(t ?? "").split(" / ").map((part) => { const o = own.find((x) => x.value === part); return (o && values.get(o.id)?.value) || part }).join(" / ")
  }
  const { optionValues: _o, ...body } = raw
  res.json({
    ...body,
    currencyLabel: currencyLabelIn(lang),
    store: { name: c.name },
    lowStock: { ...raw.lowStock, items: raw.lowStock.items.map((v) => ({ ...v, product: title(v.product_id, v.product), variant: variantTitle(v.id, v.variant) })) },
    topProducts: raw.topProducts.map((p) => ({ ...p, title: title(p.id, p.title) })),
    byGovernorate: raw.byGovernorate.map(({ code, ...g }) => ({ name: govName(code), ...g })),
  })
}
