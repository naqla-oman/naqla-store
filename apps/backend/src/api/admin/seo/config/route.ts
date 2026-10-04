import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "../../../../lib/client"

/** GET /admin/seo/config — رابط المتجر واسمه لمعاينة نتيجة قوقل في widget السيو */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const c = client()
  res.json({ storefront: process.env.STOREFRONT_URL || "http://localhost:8000", country: c.country, name: c.name })
}
