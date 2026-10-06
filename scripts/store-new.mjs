// pnpm store:new <slug> [--template fashion|perfume|empty] [--name "اسم المتجر"] [--phone 968…] [--email a@b]
// ينسخ قالب المتجر (templates/<name>) إلى clients/<slug> ويملأ العناصر النائبة باسم العميل وبياناته
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CLIENTS, ROOT, c, fail, slugArg } from "./lib.mjs"

const slug = slugArg()
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
const template = arg("--template", "empty")
const src = join(ROOT, "templates", template)
if (!existsSync(join(src, "store.json"))) fail(`القالب غير موجود: templates/${template} (المتاح: ${readdirSync(join(ROOT, "templates")).join("، ")})`)
const dest = join(CLIENTS, slug)
if (existsSync(dest)) fail(`clients/${slug} موجود مسبقاً`)

const name = arg("--name", slug)
const en = slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
const phone = (arg("--phone", "96890000000") || "").replace(/\D/g, "")
const values = {
  __SLUG__: slug, __NAME__: name, __SHORT__: arg("--short", name), __NAME_EN__: en.toUpperCase(), __SHORT_EN__: en,
  __CODE__: slug.replace(/-/g, "").toUpperCase().slice(0, 10), __WHATSAPP__: phone, __PHONE__: `+${phone}`, __EMAIL__: arg("--email", `hello@${slug}.example`),
}
cpSync(src, dest, { recursive: true, filter: (p) => !p.endsWith("template.json") })
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
for (const f of walk(dest).filter((f) => /\.(json|css|svg|md)$/.test(f))) {
  let s = readFileSync(f, "utf8")
  for (const [k, v] of Object.entries(values)) s = s.replaceAll(k, v)
  writeFileSync(f, s)
}
console.log(c.g(`✔ أُنشئ clients/${slug}/ من قالب «${JSON.parse(readFileSync(join(src, "template.json"), "utf8")).name}»`))
console.log(`  التالي: ${c.b(`pnpm store:setup ${slug}`)} ثم ${c.b(`pnpm store:dev ${slug}`)}`)
