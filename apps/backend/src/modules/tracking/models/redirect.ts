import { model } from "@medusajs/framework/utils"

/** تحويل 301 دائم: يُنشأ تلقائياً عند تغيير رابط منتج أو قسم (from_path → to_path) */
export const SeoRedirect = model
  .define("seo_redirect", {
    id: model.id({ prefix: "rdr" }).primaryKey(),
    from_path: model.text().unique(),
    to_path: model.text(),
    entity: model.enum(["product", "category"]),
    entity_id: model.text(),
  })
