import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { client } from "../../../../lib/client"

/** GET /admin/naqla/support — بيانات الدعم الفني من نقلة (admin-brand/support.json) + المتجر وإصدار نقلة للتذكرة */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const file = join(process.cwd(), "admin-brand", "support.json")
  const raw = existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : {}
  const contact = Object.fromEntries(Object.entries(raw).filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim()))
  // إصدار نقلة من package.json الجذر (لا إصدار المحرّك): يُرفع مع كل إصدار للمنصة
  let version = ""
  try { version = JSON.parse(readFileSync(join(process.cwd(), "..", "..", "package.json"), "utf-8")).version ?? "" } catch { version = "" }
  const c = client()
  res.json({ contact, store: { name: c.name, slug: c.slug }, platform: { version } })
}
