import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { tokens } from "../../../lib/arabic-search"
import { readTranslations } from "../../../lib/translations"

/**
 * GET /store/search?q= — بحث عربي مُطبَّع (H10). يعيد معرّفات المنتجات مرتبة بالصلة + أقسام مقترحة.
 * كل كلمة في الاستعلام يجب أن تطابق (بالبادئة) كلمة في: العنوان، القسم، الوسوم، المجموعة، أو الوصف.
 * الكتالوج يُحفظ في الذاكرة 60 ثانية.
 */
type Doc = { id: string; title: string[]; cats: string[]; other: string[]; desc: string[] }
let cache: { at: number; docs: Doc[]; categories: { name: string; handle: string; toks: string[] }[] } | null = null

async function load(req: MedusaRequest) {
  if (cache && Date.now() - cache.at < 60_000) return cache
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "subtitle", "description", "status", "metadata", "categories.id", "categories.name", "tags.value", "collection.title", "options.values.id", "options.values.value"],
    filters: { status: "published" } as any,
    pagination: { take: 5000 },
  })
  const { data: cats } = await query.graph({ entity: "product_category", fields: ["name", "handle", "is_active"], pagination: { take: 500 } })
  // المرحلة 2: الترجمات الإنجليزية تدخل الفهرس نفسه فيجد البحث الإنجليزي المنتجات المترجمة
  const [trP, trC, trV] = await Promise.all([readTranslations(req.scope, "product", "en-US", { fields: ["title", "subtitle", "description"] }), readTranslations(req.scope, "product_category", "en-US", { fields: ["name"] }), readTranslations(req.scope, "product_option_value", "en-US", { fields: ["value"] })])
  const enCat = (c: any) => trC.get(c.id)?.name ?? ""
  const docs = (products as any[])
    .filter((p) => !p.metadata?.service)
    .map((p) => ({
      id: p.id,
      title: tokens(`${p.title} ${p.subtitle ?? ""} ${trP.get(p.id)?.title ?? ""} ${trP.get(p.id)?.subtitle ?? ""}`),
      cats: tokens((p.categories ?? []).map((c: any) => `${c.name} ${enCat(c)}`).join(" ")),
      // الوسوم والمجموعة وقيم الخيارات (الألوان والمقاسات والأحجام): «أسود»، «54»، «100 مل»
      other: tokens(`${(p.tags ?? []).map((t: any) => t.value).join(" ")} ${p.collection?.title ?? ""} ${(p.options ?? []).flatMap((o: any) => (o.values ?? []).map((v: any) => `${v.value} ${trV.get(v.id)?.value ?? ""}`)).join(" ")}`),
      desc: tokens(`${p.description ?? ""} ${trP.get(p.id)?.description ?? ""}`),
    }))
  const categories = (cats as any[]).filter((c) => c.is_active !== false).map((c) => ({ name: c.name, handle: c.handle, toks: tokens(`${c.name} ${enCat(c)}`) }))
  cache = { at: Date.now(), docs, categories }
  return cache
}

const hit = (q: string, words: string[]) => words.some((w) => w.startsWith(q) || (q.length >= 4 && w.includes(q)))

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = tokens(String(req.query.q ?? "").slice(0, 100))
  const { docs, categories } = await load(req)
  if (!q.length) return res.json({ ids: [], categories: categories.slice(0, 6).map(({ name, handle }) => ({ name, handle })) })
  const scored = docs
    .map((d) => {
      let score = 0
      for (const t of q) {
        const s = hit(t, d.title) ? 3 : hit(t, d.cats) ? 2 : hit(t, d.other) ? 2 : hit(t, d.desc) ? 1 : 0
        if (!s) return null
        score += s
      }
      return { id: d.id, score }
    })
    .filter(Boolean) as { id: string; score: number }[]
  scored.sort((a, b) => b.score - a.score)
  const related = categories.filter((c) => q.some((t) => hit(t, c.toks))).map(({ name, handle }) => ({ name, handle }))
  res.json({ ids: scored.map((s) => s.id), categories: related.length ? related : categories.slice(0, 6).map(({ name, handle }) => ({ name, handle })) })
}
