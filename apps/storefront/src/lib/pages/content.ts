import "server-only"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { storeConfig as c } from "../../store.config"
import { localizedStoreConfig } from "../../i18n/store-config"
const { clientDir } = require("../../../client.js")

/** H12: صفحة المتجر من clients/<slug>/pages/<page>.md أو المسودة العامة في clients/_template/pages */
export const PAGES = ["returns", "terms", "privacy", "faq", "about", "stores", "size-guide"] as const

/**
 * بلغة الصفحة: <page>.<lang>.md عند العميل ثم في _template، وإلا الملف العربي (لا تظهر صفحة فارغة أبداً).
 * المتغيرات {{name}}… من إعداد المتجر بلغة الصفحة (ترجمات store في locales/en.json).
 */
export function readPage(page: string, lang = "ar"): { title: string; body: string } | null {
  if (!(PAGES as readonly string[]).includes(page)) return null
  if (page === "size-guide" && !c.features.sizeGuide) return null
  const dirs = [join(clientDir(), "pages"), join(clientDir(), "..", "_template", "pages")]
  const names = lang === "ar" ? [`${page}.md`] : [`${page}.${lang}.md`, `${page}.md`]
  const file = names.flatMap((n) => dirs.map((d) => join(d, n))).find((f) => existsSync(f)) ?? null
  if (!file) return null
  const sc = localizedStoreConfig(lang)
  const vars: Record<string, string> = {
    name: sc.name,
    description: sc.description,
    returnDays: String(sc.seo.returnDays || 7),
    phone: sc.contact.phone,
    email: sc.contact.email,
    address: sc.contact.address || sc.seo.location.address,
    city: sc.seo.location.city,
    location: sc.seo.location.name || sc.name,
  }
  const md = readFileSync(file, "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "")
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? sc.name
  return { title, body: md }
}
