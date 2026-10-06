import "server-only"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { storeConfig as c } from "../../store.config"
const { clientDir } = require("../../../client.js")

/** H12: صفحة المتجر من clients/<slug>/pages/<page>.md أو المسودة العامة في clients/_template/pages */
export const PAGES = ["returns", "terms", "privacy", "faq", "about", "stores", "size-guide"] as const

export function readPage(page: string): { title: string; body: string } | null {
  if (!(PAGES as readonly string[]).includes(page)) return null
  if (page === "size-guide" && !c.features.sizeGuide) return null
  const own = join(clientDir(), "pages", `${page}.md`)
  const fallback = join(clientDir(), "..", "_template", "pages", `${page}.md`)
  const file = existsSync(own) ? own : existsSync(fallback) ? fallback : null
  if (!file) return null
  const vars: Record<string, string> = {
    name: c.name,
    description: c.description,
    returnDays: String(c.seo.returnDays || 7),
    phone: c.contact.phone,
    email: c.contact.email,
    address: c.contact.address || c.seo.location.address,
    city: c.seo.location.city,
    location: c.seo.location.name || c.name,
  }
  const md = readFileSync(file, "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "")
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? c.name
  return { title, body: md }
}
