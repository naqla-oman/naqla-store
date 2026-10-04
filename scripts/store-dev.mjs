// pnpm store:dev <slug> — يشغّل خلفية المتجر وواجهته بمنفذيه وقاعدته (من .stores/<slug>.env)
import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { BACKEND, STOREFRONT, c, fail, readEnv, slugArg, storeEnvFile } from "./lib.mjs"

const slug = slugArg()
const file = storeEnvFile(slug)
if (!existsSync(file)) fail(`المتجر غير مُعدّ — شغّلي أولاً: pnpm store:setup ${slug}`)
const env = { ...process.env, ...readEnv(file) }

// Next يضيف مسار مجلد البناء إلى ملف tsconfig الذي يستخدمه؛ نعطي كل منفذ ملفاً خاصاً خارج Git
// يرث الأصلي، فلا يتغيّر tsconfig.json المتتبَّع أبداً (حتى لو توقّف التشغيل فجأة)
const TSCONFIG = `tsconfig.${env.STOREFRONT_PORT}.json`
const base = JSON.parse(readFileSync(join(STOREFRONT, "tsconfig.json"), "utf8"))
writeFileSync(
  join(STOREFRONT, TSCONFIG),
  JSON.stringify({ extends: "./tsconfig.json", include: [...base.include, `.next-${env.STOREFRONT_PORT}/types/**/*.ts`] }, null, 2) + "\n"
)

const start = (name, cmd, args, cwd, extra = {}) => {
  // مجموعة عمليات مستقلة: Medusa وNext يشغّلان الخادم كعملية فرعية، فالإيقاف يجب أن يشمل المجموعة كلها
  const p = spawn(cmd, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"], detached: true })
  const tag = name === "backend" ? c.y(`[${slug}:backend]`) : c.g(`[${slug}:store]`)
  const out = (d) => d.toString().split("\n").filter(Boolean).forEach((l) => {
    console.log(`${tag} ${l}`)
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
  start("store", "npx", ["next", "dev", "--turbopack", "-p", env.STOREFRONT_PORT], STOREFRONT, { NEXT_DIST_DIR: `.next-${env.STOREFRONT_PORT}`, NEXT_TSCONFIG: TSCONFIG }),
]
const stopAll = (sig = "SIGTERM") => procs.forEach((p) => { try { process.kill(-p.pid, sig) } catch { /* انتهت */ } })
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopAll(sig); process.exit(0) })
process.on("exit", () => stopAll())
