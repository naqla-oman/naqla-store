import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/naqla/product-ids?limit&offset&category_id — منخفضة: قوائم «الأحدث» بلا منتج الخدمة على مستوى الاستعلام.
 * (كان يُجلب ثم يُخفى فتظهر الصفحة الأولى 11 بدل 12.) المعرّفات مرتبة بالأحدث، مع العدد الكلي الصحيح.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12))
  const offset = Math.max(0, Number(req.query.offset) || 0)
  const cat = typeof req.query.category_id === "string" && /^pcat_[A-Za-z0-9]+$/.test(req.query.category_id) ? req.query.category_id : null
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const where = `p.deleted_at is null and p.status = 'published' and coalesce(p.metadata->>'service', 'false') <> 'true'
    ${cat ? `and exists (select 1 from product_category_product pcp where pcp.product_id = p.id and pcp.product_category_id = '${cat}')` : ""}`
  const rows = (await pg.raw(`select p.id, count(*) over () as n from product p where ${where} order by p.created_at desc, p.id limit ${limit} offset ${offset}`)).rows as any[]
  const count = rows.length ? Number(rows[0].n) : Number((await pg.raw(`select count(*) as n from product p where ${where}`)).rows[0].n)
  res.json({ ids: rows.map((r) => r.id), count })
}
