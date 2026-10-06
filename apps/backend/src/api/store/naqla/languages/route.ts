import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "../../../../lib/client"

/** لغات المتجر (store.json + إعدادات اللوحة) — يقرؤها وسيط الواجهة لتحديد المسارات المتاحة */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const c = client() as any
  const languages: string[] = Array.isArray(c.languages) && c.languages.length ? c.languages : ["ar"]
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ languages, defaultLanguage: languages.includes(c.defaultLanguage) ? c.defaultLanguage : languages[0] })
}
