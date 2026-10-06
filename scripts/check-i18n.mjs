// pnpm check:i18n — يفشل إذا بقي نص عربي مكتوب مباشرة في مكوّنات الواجهة، ويطبع المفاتيح الناقصة في en.json. المعيار: 0.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
const SF = new URL("../apps/storefront/", import.meta.url).pathname
const AR = /[\u0600-\u06FF]/
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) ? [p] : [] })
const files = [...walk(join(SF, "src/modules")), ...walk(join(SF, "src/app")), ...walk(join(SF, "src/lib"))]
let hits = []
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n")
  lines.forEach((l, i) => {
    // تُستثنى التعليقات والتعابير النمطية (مثل /ة$/) — ليست نصوص واجهة
    const code = l.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").replace(/\/(?:\\.|[^\/\n])+\/[gimsuy]*/g, "")
    if (l.includes("i18n-ok")) return // سطر مُعلَّم: ليس نص واجهة (صرف عربي، بيانات)
    if (AR.test(code) && !/^\s*\*|^\s*\/\*/.test(l)) hits.push(`${f.replace(SF, "")}:${i + 1}: ${l.trim().slice(0, 90)}`)
  })
}
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]))
const ar = flat(JSON.parse(readFileSync(join(SF, "messages/ar.json"), "utf8"))), en = new Set(flat(JSON.parse(readFileSync(join(SF, "messages/en.json"), "utf8"))))
const missing = ar.filter((k) => !en.has(k))
const byFile = {}
for (const h of hits) { const f = h.split(":")[0]; byFile[f] = (byFile[f] ?? 0) + 1 }
if (process.argv.includes("--list")) console.log(hits.join("\n"))
console.log(`نصوص عربية مباشرة: ${hits.length} في ${Object.keys(byFile).length} ملفاً`)
if (process.argv.includes("--files")) Object.entries(byFile).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${n}\t${f}`))
console.log(`مفاتيح ar.json: ${ar.length} — ناقصة في en.json: ${missing.length}${missing.length ? "\n  " + missing.slice(0, 20).join("\n  ") : ""}`)
process.exit(hits.length || missing.length ? 1 : 0)
