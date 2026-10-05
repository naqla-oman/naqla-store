import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { client } from "../../../../lib/client"

/** GET /admin/naqla/support — بيانات الدعم الفني من نقلة (admin-brand/support.json) + معلومات المتجر للتذكرة */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const file = join(process.cwd(), "admin-brand", "support.json")
  const raw = existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : {}
  const contact = Object.fromEntries(Object.entries(raw).filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim()))
  let medusa = ""
  try { medusa = JSON.parse(readFileSync(join(process.cwd(), "node_modules", "@medusajs", "medusa", "package.json"), "utf-8")).version } catch { medusa = "" }
  const c = client()
  res.json({ contact, store: { name: c.name, slug: c.slug }, platform: { medusa } })
}
