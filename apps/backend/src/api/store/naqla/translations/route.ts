import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readTranslations } from "../../../../lib/translations"

/**
 * GET /store/naqla/translations?reference=shipping_option&locale=en-US
 * ترجمات كيان لا يطبّقها Store API بنفسه (خيارات الشحن، ولقطات السلة/الطلب): { "<id>": { name: "…" } }
 */
const ALLOWED = new Set(["shipping_option", "shipping_option_type", "product_category", "product_collection", "product_option_value", "product_option", "product"])
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // وسيط Medusa يحذف ?locale من الاستعلام ويضعه في req.locale
  const reference = String(req.query.reference ?? ""), locale = String((req as any).locale ?? req.query.locale ?? "")
  if (!ALLOWED.has(reference) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) return res.status(400).json({ message: "reference/locale غير صالح" })
  const map = await readTranslations(req.scope, reference, locale)
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ translations: Object.fromEntries(map) })
}
