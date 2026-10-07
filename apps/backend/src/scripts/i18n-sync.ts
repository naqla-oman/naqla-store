import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { clientDir } from "../lib/client"
import { queueRevalidate } from "../lib/revalidate"
import { medusaLocale, upsertTranslations } from "../lib/translations"

/**
 * المرحلة 2: زرع ترجمات المحتوى من clients/<slug>/locales/en.json إلى وحدة ترجمة Medusa (upsert، قابل للتكرار).
 *   npx medusa exec ./src/scripts/i18n-sync.ts
 * شكل الملف:
 *   products:    { "<handle>": { title, subtitle?, description?, material? } }
 *   options:     { "<عنوان الخيار العربي>": { title: "Color", values: { "أسود": "Black", … } } }   ← مشترك بين المنتجات
 *   categories:  { "<handle>": { name, description? } }
 *   collections: { "<handle>": { title } }
 *   shipping:    { "<type code>": "Standard delivery" | { name, desc } }   (الاسم على shipping_option، والوصف على shipping_option_type)
 * ويضبط محلّيات المتجر المدعومة (ar-SA للوحة، en-US).
 */
export default async function run({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const file = join(clientDir(), "locales", "en.json")
  if (!existsSync(file)) { logger.info(`i18n-sync: لا يوجد ${file} — لا شيء يُزرع`); return }
  const en = JSON.parse(readFileSync(file, "utf8")) as any
  const locale = medusaLocale("en")
  const items: { reference: string; reference_id: string; locale_code: string; translations: Record<string, string> }[] = []

  const { data: products } = await query.graph({ entity: "product", fields: ["id", "handle", "options.id", "options.title", "options.values.id", "options.values.value"], pagination: { take: 5000 } })
  const optionDefs: Record<string, { title?: string; values?: Record<string, string> }> = en.options ?? {}
  for (const p of products as any[]) {
    const tr = en.products?.[p.handle]
    if (tr) items.push({ reference: "product", reference_id: p.id, locale_code: locale, translations: pick(tr, ["title", "subtitle", "description", "material"]) })
    for (const o of p.options ?? []) {
      const def = optionDefs[o.title]
      if (!def) continue
      if (def.title) items.push({ reference: "product_option", reference_id: o.id, locale_code: locale, translations: { title: def.title } })
      for (const v of o.values ?? []) if (def.values?.[v.value]) items.push({ reference: "product_option_value", reference_id: v.id, locale_code: locale, translations: { value: def.values[v.value] } })
    }
  }
  const { data: cats } = await query.graph({ entity: "product_category", fields: ["id", "handle"], pagination: { take: 500 } })
  for (const c of cats as any[]) if (en.categories?.[c.handle]) items.push({ reference: "product_category", reference_id: c.id, locale_code: locale, translations: pick(en.categories[c.handle], ["name", "description"]) })
  const { data: cols } = await query.graph({ entity: "product_collection", fields: ["id", "handle"], pagination: { take: 500 } })
  for (const c of cols as any[]) if (en.collections?.[c.handle]) items.push({ reference: "product_collection", reference_id: c.id, locale_code: locale, translations: pick(en.collections[c.handle], ["title"]) })
  const { data: opts } = await query.graph({ entity: "shipping_option", fields: ["id", "type.id", "type.code"], pagination: { take: 100 } })
  for (const o of opts as any[]) {
    const sh = en.shipping?.[o.type?.code]
    if (!sh) continue
    const name = typeof sh === "string" ? sh : sh.name, desc = typeof sh === "string" ? undefined : sh.desc
    if (name) items.push({ reference: "shipping_option", reference_id: o.id, locale_code: locale, translations: { name } })
    if (o.type?.id && (name || desc)) items.push({ reference: "shipping_option_type", reference_id: o.type.id, locale_code: locale, translations: { ...(name ? { label: name } : {}), ...(desc ? { description: desc } : {}) } })
  }

  const r = await upsertTranslations(container, items)
  logger.info(`i18n-sync: ${items.length} عنصراً — أُنشئ ${r.created}، حُدِّث ${r.updated}`)
  queueRevalidate(["products", "categories", "collections", "shipping-threshold"], logger)

  const storeSvc = container.resolve(Modules.STORE)
  const [store] = await storeSvc.listStores({}, { take: 1 })
  if (store) {
    await updateStoresWorkflow(container).run({ input: { selector: { id: store.id }, update: { supported_locales: [{ locale_code: "ar-SA" }, { locale_code: "en-US" }] } as any } })
    logger.info("i18n-sync: محلّيات المتجر ar-SA + en-US")
  }
}

const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => typeof o?.[k] === "string" && (o[k] as string).trim()).map((k) => [k, o[k] as string]))
