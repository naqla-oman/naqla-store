// أدوات مشتركة لأوامر store:new / store:setup / store:dev
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const CLIENTS = join(ROOT, "clients")
export const STORES = join(ROOT, ".stores")
export const BACKEND = join(ROOT, "apps/backend")
export const STOREFRONT = join(ROOT, "apps/storefront")

export const c = { b: (s) => `\x1b[1m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` }

export function fail(msg) {
  console.error(c.r(`✖ ${msg}`))
  process.exit(1)
}

export function slugArg() {
  const slug = (process.argv[2] || "").trim()
  if (!slug) fail("حدّدي اسم المتجر: pnpm <الأمر> <slug>   (مثال: pnpm store:new demo-perfume)")
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) || slug.startsWith("_")) {
    fail(`اسم غير صالح «${slug}» — حروف لاتينية صغيرة وأرقام وشرطات فقط`)
  }
  return slug
}

/** يقرأ ملف KEY=VALUE (يتجاهل التعليقات) */
export function readEnv(file) {
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
  )
}

export const storeEnvFile = (slug) => join(STORES, `${slug}.env`)
export const listStoreEnvs = () => (existsSync(STORES) ? readdirSync(STORES).filter((f) => f.endsWith(".env")) : [])

/** يشغّل أمراً ويعيد مخرجاته؛ يطبعها مباشرة إن طُلب */
export function run(cmd, args, { cwd, env, echo = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    const take = (d) => { out += d; if (echo) process.stdout.write(d) }
    p.stdout.on("data", take)
    p.stderr.on("data", take)
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(Object.assign(new Error(`${cmd} ${args.join(" ")} → ${code}`), { out }))))
  })
}
