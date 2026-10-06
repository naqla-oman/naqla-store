// pnpm check:i18n [--list] — يفشل إذا بقي نص عربي مكتوب مباشرة في مكوّنات الواجهة، ويطبع المفاتيح الناقصة في en.json. المعيار: 0.
// يعتمد على شجرة TypeScript (AST): سلاسل نصية، قوالب، نص JSX وسماته — بلا تعليقات ولا تعابير نمطية (RegularExpressionLiteral).
import { createRequire } from "node:module"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
const SF = new URL("../apps/storefront/", import.meta.url).pathname
const ts = createRequire(join(SF, "package.json"))("typescript")
const AR = /[\u0600-\u06FF]/
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) ? [p] : [] })
const files = [...walk(join(SF, "src/modules")), ...walk(join(SF, "src/app")), ...walk(join(SF, "src/lib"))]
const hits = []
for (const f of files) {
  const text = readFileSync(f, "utf8")
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1
  const ok = (node) => { // سطر مُعلَّم i18n-ok (تعليق في نهاية السطر أو قبله) ليس نص واجهة
    const l = lineOf(node.getStart()); const lines = text.split("\n")
    return /i18n-ok/.test(lines[l - 1] ?? "") || /i18n-ok/.test(lines[l - 2] ?? "")
  }
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      const v = n.text ?? ""
      if (AR.test(v) && !ok(n)) hits.push(`${f.replace(SF, "")}:${lineOf(n.getStart())}: ${v.trim().slice(0, 80)}`)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]))
const ar = flat(JSON.parse(readFileSync(join(SF, "messages/ar.json"), "utf8"))), en = new Set(flat(JSON.parse(readFileSync(join(SF, "messages/en.json"), "utf8"))))
const missing = ar.filter((k) => !en.has(k))
// مكوّنات العميل: كل مساحة useT("…") يجب أن تكون في CLIENT_NAMESPACES (وإلا لا تصل إلى المتصفح)
const cfg = readFileSync(join(SF, "src/i18n/config.ts"), "utf8")
const clientNs = new Set(JSON.parse((cfg.match(/CLIENT_NAMESPACES = (\[[^\]]*\])/) ?? [, "[]"])[1]))
const nsHits = []
for (const f of files) {
  const text = readFileSync(f, "utf8")
  if (!/^\s*["']use client["']/m.test(text.slice(0, 300))) continue
  for (const m of text.matchAll(/useT\("([^"]+)"\)/g)) if (!clientNs.has(m[1])) nsHits.push(`${f.replace(SF, "")}: ${m[1]}`)
  if (/\bt\("common\./.test(text) && !clientNs.has("common")) nsHits.push(`${f.replace(SF, "")}: common`)
}
if (nsHits.length) console.log(`مساحات أسماء خارج CLIENT_NAMESPACES في مكوّنات عميل: ${nsHits.length}\n  ${nsHits.join("\n  ")}`)
const byFile = {}
for (const h of hits) { const f = h.split(":")[0]; byFile[f] = (byFile[f] ?? 0) + 1 }
if (process.argv.includes("--list")) console.log(hits.join("\n"))
console.log(`نصوص عربية مباشرة: ${hits.length} في ${Object.keys(byFile).length} ملفاً`)
if (process.argv.includes("--files")) Object.entries(byFile).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${n}\t${f}`))
console.log(`مفاتيح ar.json: ${ar.length} — ناقصة في en.json: ${missing.length}${missing.length ? "\n  " + missing.slice(0, 20).join("\n  ") : ""}`)
process.exit(hits.length || missing.length || nsHits.length ? 1 : 0)
