import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * المرحلة 2: ترجمات Medusa (وحدة translation) — القراءة والكتابة (upsert) من كودنا.
 * الإنجليزية في Medusa رمزها «en-US» (رابط /en)؛ العربية هي أصل الكيان ولا تُخزَّن كترجمة.
 */
export const MEDUSA_LOCALE: Record<string, string> = { en: "en-US", ar: "ar-SA" }
export const medusaLocale = (lang: string) => MEDUSA_LOCALE[lang] ?? lang

export type TranslationRow = { id: string; reference: string; reference_id: string; locale_code: string; translations: Record<string, string> }

export function translationService(container: MedusaContainer): any | null {
  try { return container.resolve(Modules.TRANSLATION) } catch { return null }
}

/** خريطة reference_id → ترجمات للكيان واللغة */
export async function readTranslations(container: MedusaContainer, reference: string | string[], locale: string): Promise<Map<string, Record<string, string>>> {
  const svc = translationService(container)
  const out = new Map<string, Record<string, string>>()
  if (!svc) return out
  const rows: TranslationRow[] = await svc.listTranslations({ reference, locale_code: locale }, { take: 5000 })
  for (const r of rows) out.set(r.reference_id, r.translations ?? {})
  return out
}

/** upsert: يدمج الحقول فوق الموجود (لا يحذف حقلاً مترجماً من قبل) */
export async function upsertTranslations(container: MedusaContainer, items: { reference: string; reference_id: string; locale_code: string; translations: Record<string, string> }[]) {
  const svc = translationService(container)
  if (!svc || !items.length) return { created: 0, updated: 0 }
  // الخيارات مشتركة بين المنتجات في Medusa 2.21 → المعرّف نفسه قد يتكرر في الدفعة: ندمج التكرارات (التفرّد: reference_id + locale)
  const merged = new Map<string, typeof items[number]>()
  for (const it of items) {
    const k = `${it.reference}:${it.reference_id}:${it.locale_code}`
    const cur = merged.get(k)
    merged.set(k, cur ? { ...cur, translations: { ...cur.translations, ...it.translations } } : { ...it })
  }
  items = [...merged.values()]
  const existing: TranslationRow[] = await svc.listTranslations({ reference_id: items.map((i) => i.reference_id) }, { take: 10000 })
  const byKey = new Map(existing.map((r) => [`${r.reference}:${r.reference_id}:${r.locale_code}`, r]))
  const toCreate: any[] = [], toUpdate: any[] = []
  for (const it of items) {
    const clean = Object.fromEntries(Object.entries(it.translations).filter(([, v]) => typeof v === "string" && v.trim()))
    if (!Object.keys(clean).length) continue
    const cur = byKey.get(`${it.reference}:${it.reference_id}:${it.locale_code}`)
    if (cur) {
      const mergedTr = { ...(cur.translations ?? {}), ...clean }
      if (JSON.stringify(mergedTr) !== JSON.stringify(cur.translations ?? {})) toUpdate.push({ id: cur.id, translations: mergedTr })
    } else toCreate.push({ ...it, translations: clean })
  }
  if (toCreate.length) await svc.createTranslations(toCreate)
  if (toUpdate.length) await svc.updateTranslations(toUpdate)
  return { created: toCreate.length, updated: toUpdate.length }
}

/**
 * لقطات الطلب/السلة (product_title, variant_title, shipping_methods.name) مخزّنة بالعربية.
 * بلغة غير العربية تُستبدل من ترجمات المنتج وقيم الخيارات وخيار الشحن (ما لا ترجمة له يبقى عربياً).
 * variant_title نصّ («50 / أسود») لا معرّفات، فتُطابَق أجزاؤه بنص القيمة العربية.
 * يحتاج الحقول: items.product_id, shipping_methods.shipping_option_id
 */
export async function localizeSnapshots(container: MedusaContainer, o: any, locale?: string | null) {
  if (!o || !locale || locale.startsWith("ar")) return o
  const [p, v, s] = await Promise.all([
    readTranslations(container, "product", locale),
    readTranslations(container, "product_option_value", locale),
    readTranslations(container, "shipping_option", locale),
  ])
  const byText = new Map<string, string>()
  if (v.size) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "product_option_value", fields: ["id", "value"], filters: { id: [...v.keys()] } })
    for (const row of data as { id: string; value: string }[]) if (v.get(row.id)?.value) byText.set(row.value, v.get(row.id)!.value)
  }
  for (const i of o.items ?? []) {
    const title = i.product_id && p.get(i.product_id)?.title
    if (title) i.product_title = title
    if (i.variant_title && byText.size) i.variant_title = String(i.variant_title).split(" / ").map((x) => byText.get(x) ?? x).join(" / ")
  }
  for (const m of o.shipping_methods ?? []) {
    const name = m.shipping_option_id && s.get(m.shipping_option_id)?.name
    if (name) m.name = name
  }
  return o
}
