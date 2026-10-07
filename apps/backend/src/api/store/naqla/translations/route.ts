import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { publishedProductIds, readTranslations } from "../../../../lib/translations"

/**
 * GET /store/naqla/translations?reference=shipping_option&locale=en-US[&ids=a,b,c][&fields=title,subtitle]
 * ترجمات كيان لا يطبّقها Store API بنفسه (خيارات الشحن، ولقطات السلة/الطلب): { "<id>": { name: "…" } }
 * - ids: حصر الصفوف في المعرّفات المطلوبة (حتى 200) بدل الكتالوج كله؛ fields: الحقول اللازمة فقط.
 * - بلا ids للمنتجات: كل المنشورة على صفحات (لا حدّ صامت). المنتجات غير المنشورة تُستبعد دائماً.
 * لقيم الخيارات يُضاف sources: { "<القيمة العربية>": "<المترجمة>" } لأن لقطة variant_title في السلة/الطلب نصّ لا معرّفات.
 */
const ALLOWED = new Set(["shipping_option", "shipping_option_type", "product_category", "product_collection", "product_option_value", "product_option", "product"])
const MAX_IDS = 200
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",") : []).map((x) => x.trim()).filter(Boolean)
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // وسيط Medusa يحذف ?locale من الاستعلام ويضعه في req.locale
  const reference = String(req.query.reference ?? ""), locale = String((req as any).locale ?? req.query.locale ?? "")
  if (!ALLOWED.has(reference) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) return res.status(400).json({ message: "reference/locale غير صالح" })
  const idsIn = list(req.query.ids), fields = list(req.query.fields)
  if (idsIn.length > MAX_IDS) return res.status(400).json({ message: `ids: الحد ${MAX_IDS} معرّفاً في الطلب الواحد` })
  let ids: string[] | undefined = idsIn.length ? idsIn : undefined
  if (reference === "product") ids = [...(await publishedProductIds(req.scope, ids))]
  const map = await readTranslations(req.scope, reference, locale, { ids, ...(fields.length ? { fields } : {}) })
  let sources: Record<string, string> | undefined
  if (reference === "product_option_value" && map.size) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "product_option_value", fields: ["id", "value"], filters: { id: [...map.keys()] } })
    sources = {}
    for (const v of data as { id: string; value: string }[]) if (map.get(v.id)?.value) sources[v.value] = map.get(v.id)!.value
  }
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ translations: Object.fromEntries(map), ...(sources ? { sources } : {}) })
}
