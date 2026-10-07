import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { client } from "./client"

/**
 * المرحلة 2 (مفاتيح ثابتة): الكود لا يطابق نصاً عربياً وقت التشغيل.
 * - خيار المنتج: metadata.key (size/color/length…) من تعريفات store.json → options[].key
 * - قيمة اللون: metadata.hex من swatches
 * المطابقة بالعنوان/القيمة العربية تحدث مرة واحدة هنا (عند الزرع أو إنشاء الخيار من اللوحة)، وبعدها لا تتأثر بالترجمة أو تغيير الاسم.
 */
export async function stampOptionKeys(container: MedusaContainer) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const defs: { key: string; title: string; type?: string; swatches?: Record<string, [string, string]> }[] = (client() as any).options ?? []
  let options = 0, values = 0
  for (const d of defs) {
    const r = await pg.raw(`update product_option set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('key', ?::text) where title = ? and deleted_at is null and coalesce(metadata->>'key', '') <> ?`, [d.key, d.title, d.key])
    options += r.rowCount ?? 0
    for (const [val, hex] of Object.entries(d.swatches ?? {})) {
      const rv = await pg.raw(`update product_option_value v set metadata = coalesce(v.metadata, '{}'::jsonb) || jsonb_build_object('hex', ?::jsonb) from product_option o where v.option_id = o.id and o.deleted_at is null and v.deleted_at is null and coalesce(o.metadata->>'key', o.title) in (?, ?) and v.value = ? and coalesce(v.metadata->>'hex', '') <> ?::text`, [JSON.stringify(hex), d.key, d.title, val, JSON.stringify(hex)])
      values += rv.rowCount ?? 0
    }
  }
  return { options, values }
}
