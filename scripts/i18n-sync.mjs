// pnpm i18n:sync <slug> — يزرع ترجمات المحتوى من clients/<slug>/locales/en.json في قاعدة المتجر (upsert)
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, c, fail, run, slugArg } from "./lib.mjs"
const slug = slugArg()
const envFile = join(ROOT, ".stores", `${slug}.env`)
if (!existsSync(envFile)) fail(`المتجر غير مُعدّ: pnpm store:setup ${slug}`)
const env = Object.fromEntries(readFileSync(envFile, "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
const out = await run("npx", ["medusa", "exec", "./src/scripts/i18n-sync.ts"], { cwd: join(ROOT, "apps", "backend"), env: { ...process.env, ...env, STORE: slug } }).catch((e) => fail(`فشل الزرع:\n${(e.out ?? e.message).slice(-3000)}`))
console.log(c.g(`✔ ${(out.match(/i18n-sync: [^\n]+/g) ?? ["تم"]).join(" | ").replace(/\x1b\[[0-9;]*m/g, "")}`))
