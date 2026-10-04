// pnpm store:dev <slug> — يشغّل خلفية المتجر وواجهته بمنفذيه وقاعدته (من .stores/<slug>.env)
import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { BACKEND, STOREFRONT, c, fail, readEnv, slugArg, storeEnvFile } from "./lib.mjs"

const slug = slugArg()
const file = storeEnvFile(slug)
if (!existsSync(file)) fail(`المتجر غير مُعدّ — شغّلي أولاً: pnpm store:setup ${slug}`)
const env = { ...process.env, ...readEnv(file) }

// Next يضيف مسار مجلد البناء إلى tsconfig.json عند كل تشغيل؛ نعيده كما كان بعد الإقلاع حتى لا يتغيّر المستودع
const TSCONFIG = join(STOREFRONT, "tsconfig.json")
const tsconfigBefore = readFileSync(TSCONFIG, "utf8")
const restoreTsconfig = () => {
  if (readFileSync(TSCONFIG, "utf8") !== tsconfigBefore) writeFileSync(TSCONFIG, tsconfigBefore)
}

const start = (name, cmd, args, cwd, extra = {}) => {
  const p = spawn(cmd, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] })
  const tag = name === "backend" ? c.y(`[${slug}:backend]`) : c.g(`[${slug}:store]`)
  const out = (d) => d.toString().split("\n").filter(Boolean).forEach((l) => {
    console.log(`${tag} ${l}`)
    if (name === "store" && /Ready in|✓ Ready/.test(l)) restoreTsconfig()
  })
  p.stdout.on("data", out)
  p.stderr.on("data", out)
  p.on("exit", (code) => { console.log(`${tag} توقّف (${code})`); process.exit(code ?? 0) })
  return p
}

console.log(c.b(`▶ «${slug}»: المتجر ${env.STOREFRONT_URL} — اللوحة ${env.MEDUSA_BACKEND_URL}/app`))
const procs = [
  start("backend", "npx", ["medusa", "develop", "-p", env.BACKEND_PORT], BACKEND),
  // مجلد بناء لكل منفذ حتى لا يتصادم متجران يعملان من المجلد نفسه
  start("store", "npx", ["next", "dev", "--turbopack", "-p", env.STOREFRONT_PORT], STOREFRONT, { NEXT_DIST_DIR: `.next-${env.STOREFRONT_PORT}` }),
]
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { procs.forEach((p) => p.kill(sig)); restoreTsconfig(); process.exit(0) })
