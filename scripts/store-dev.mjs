// pnpm store:dev <slug> — يشغّل خلفية المتجر وواجهته بمنفذيه وقاعدته (من .stores/<slug>.env)
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { BACKEND, STOREFRONT, c, fail, readEnv, slugArg, storeEnvFile } from "./lib.mjs"

const slug = slugArg()
const file = storeEnvFile(slug)
if (!existsSync(file)) fail(`المتجر غير مُعدّ — شغّلي أولاً: pnpm store:setup ${slug}`)
const env = { ...process.env, ...readEnv(file) }

const start = (name, cmd, args, cwd, extra = {}) => {
  const p = spawn(cmd, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] })
  const tag = name === "backend" ? c.y(`[${slug}:backend]`) : c.g(`[${slug}:store]`)
  const out = (d) => d.toString().split("\n").filter(Boolean).forEach((l) => console.log(`${tag} ${l}`))
  p.stdout.on("data", out)
  p.stderr.on("data", out)
  p.on("exit", (code) => { console.log(`${tag} توقّف (${code})`); process.exit(code ?? 0) })
  return p
}

console.log(c.b(`▶ «${slug}»: المتجر ${env.STOREFRONT_URL} — اللوحة ${env.MEDUSA_BACKEND_URL}/app`))
const procs = [
  start("backend", "npx", ["medusa", "develop", "-p", env.BACKEND_PORT], BACKEND),
  // مجلد بناء خاص بالمتجر حتى لا يتصادم مع متجر آخر يعمل من نفس المجلد
  start("store", "npx", ["next", "dev", "--turbopack", "-p", env.STOREFRONT_PORT], STOREFRONT, { NEXT_DIST_DIR: `.next-${slug}` }),
]
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { procs.forEach((p) => p.kill(sig)); process.exit(0) })
