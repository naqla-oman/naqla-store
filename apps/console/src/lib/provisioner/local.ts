import { spawn } from "node:child_process"
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"
import type { Driver, Log, StoreSpec } from "./types"

/**
 * سائق «local» (التطوير): يستخدم أدوات المستودع نفسها — store:new / store:setup / store:dev —
 * ويحفظ العمليات في .stores/<slug>.pid والسجلات في .stores/logs/<slug>.log.
 */
export const ROOT = join(process.cwd(), process.cwd().endsWith("console") ? "../.." : ".")
const STORES = join(ROOT, ".stores")
const BACKUPS = join(ROOT, ".backups")
const ARCHIVE = join(ROOT, ".archive")
const BACKEND = join(ROOT, "apps", "backend")

export const readEnv = (f: string): Record<string, string> =>
  existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {}
export const storeEnv = (slug: string) => readEnv(join(STORES, `${slug}.env`))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** تشغيل أمر وكتابة مخرجاته في سجل الخطوة؛ يرفض عند رمز خروج غير صفري */
function run(cmd: string, args: string[], log: Log, opts: { cwd?: string; env?: Record<string, string> } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, env: { ...process.env, ...opts.env }, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    const take = (b: Buffer) => { const s = b.toString(); out += s; for (const l of s.split("\n")) if (l.trim()) log(l.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 300)) }
    p.stdout.on("data", take); p.stderr.on("data", take)
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(Object.assign(new Error(`${cmd} ${args[0] ?? ""} انتهى بالرمز ${code}`), { out }))))
  })
}

const pidFile = (slug: string, kind = "store") => join(STORES, `${slug}${kind === "store" ? "" : "." + kind}.pid`)
function alive(pid: number) { try { process.kill(pid, 0); return true } catch { return false } }
async function killPid(file: string) {
  if (!existsSync(file)) return
  const pid = Number(readFileSync(file, "utf8"))
  if (pid && alive(pid)) {
    try { process.kill(-pid, "SIGTERM") } catch { try { process.kill(pid, "SIGTERM") } catch { /* انتهت */ } }
    for (let i = 0; i < 40 && alive(pid); i++) await sleep(250)
    if (alive(pid)) { try { process.kill(-pid, "SIGKILL") } catch { /* */ } }
  }
  rmSync(file, { force: true })
  await sleep(1500) // تحرير المنافذ
}
/**
 * كل عمليات المتجر (بيئتها STORE=<slug>) — `medusa develop` يولّد خادماً خارج مجموعة العمليات
 * فلا تصله إشارة المجموعة ويبقى يتيماً يحجز المنفذ والذاكرة. يُقرأ من /proc (Linux).
 */
function storePids(slug: string): number[] {
  const out: number[] = []
  for (const d of readdirSync("/proc").filter((x) => /^\d+$/.test(x))) {
    const pid = Number(d)
    if (pid === process.pid) continue
    try { if (readFileSync(`/proc/${d}/environ`, "latin1").split("\0").includes(`STORE=${slug}`)) out.push(pid) } catch { /* انتهت أو بلا صلاحية */ }
  }
  return out
}
async function killStore(slug: string) {
  await killPid(pidFile(slug))
  for (const sig of ["SIGTERM", "SIGKILL"] as const) {
    const left = storePids(slug)
    if (!left.length) return
    for (const pid of left) { try { process.kill(pid, sig) } catch { /* انتهت */ } }
    await sleep(sig === "SIGTERM" ? 3000 : 1000)
  }
}

function startDetached(args: string[], logFile: string, pid: string) {
  mkdirSync(join(STORES, "logs"), { recursive: true })
  const fd = openSync(logFile, "a")
  const p = spawn("node", args, { cwd: ROOT, detached: true, stdio: ["ignore", fd, fd], env: { ...process.env } })
  p.unref()
  writeFileSync(pid, String(p.pid))
}

export const local: Driver = {
  name: "local",

  async createFolder(spec: StoreSpec, log) {
    await run("node", ["scripts/store-new.mjs", spec.slug, "--template", spec.template, "--name", spec.name, "--phone", spec.phone, "--email", spec.email], log)
    // الهوية والميزات والمخاطبة من المعالج ← store.json (الافتراضي الذي تبدأ منه «إعدادات المتجر»)
    const f = join(ROOT, "clients", spec.slug, "store.json")
    const d = JSON.parse(readFileSync(f, "utf8"))
    if (spec.palette || spec.font) d.theme = { ...(d.theme ?? {}), ...(spec.palette ? { palette: spec.palette } : {}), ...(spec.font ? { font: spec.font } : {}) }
    if (spec.voice) d.voice = spec.voice
    if (spec.features) d.features = { ...d.features, ...spec.features }
    if (spec.logoPng) {
      writeFileSync(join(ROOT, "clients", spec.slug, "logo.png"), Buffer.from(spec.logoPng, "base64"))
      d.brand = { ...(d.brand ?? {}), logo: "logo.png", wordmark: false }
    }
    writeFileSync(f, JSON.stringify(d, null, 2) + "\n")
    log(`الهوية: لوحة ${spec.palette ?? "القالب"}، خط ${spec.font ?? "القالب"}، المخاطبة ${spec.voice ?? "القالب"}${spec.logoPng ? "، شعار مرفوع" : ""}`)
  },

  async setup(spec, log) {
    await run("node", ["scripts/store-setup.mjs", spec.slug, "--admin-email", spec.email], log)
    const e = storeEnv(spec.slug)
    return { backendPort: Number(e.BACKEND_PORT), storefrontPort: Number(e.STOREFRONT_PORT) }
  },

  async resetLink(slug, log) {
    const e = storeEnv(slug)
    const out = await run("npx", ["medusa", "exec", "./src/scripts/admin-reset-link.ts"], log, { cwd: BACKEND, env: { ...e } })
    const token = (out.match(/RESET_TOKEN=(\S+)/) ?? [])[1]
    if (!token) throw new Error("لم يُولَّد رمز تعيين كلمة المرور")
    return `${e.MEDUSA_BACKEND_URL}/app/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(e.ADMIN_EMAIL)}`
  },

  async start(slug, log) {
    await killPid(pidFile(slug, "maint"))
    if (existsSync(pidFile(slug)) && alive(Number(readFileSync(pidFile(slug), "utf8")))) return log("يعمل مسبقاً")
    startDetached(["scripts/store-dev.mjs", slug], join(STORES, "logs", `${slug}.log`), pidFile(slug))
    log(`بدأ التشغيل (pid ${readFileSync(pidFile(slug), "utf8")})`)
  },

  async stop(slug, log) { await killStore(slug); log("أُوقف (مع عمليات المتجر الفرعية)") },

  async ready(slug, timeoutMs = 0) {
    const e = storeEnv(slug)
    const country = (() => { try { return JSON.parse(readFileSync(join(ROOT, "clients", slug, "store.json"), "utf8")).country ?? "om" } catch { return "om" } })()
    const deadline = Date.now() + timeoutMs
    do {
      try {
        const [b, s] = await Promise.all([
          fetch(`${e.MEDUSA_BACKEND_URL}/ready`, { signal: AbortSignal.timeout(8000) }),
          fetch(`${e.STOREFRONT_URL}/${country}`, { signal: AbortSignal.timeout(60000), redirect: "manual" }),
        ])
        if (b.ok && s.status < 500) return true
      } catch { /* لم يجهز */ }
      if (timeoutMs) await sleep(4000)
    } while (Date.now() < deadline)
    return false
  },

  async pause(slug, name, log) {
    await killStore(slug)
    startDetached(["scripts/maintenance.mjs", storeEnv(slug).STOREFRONT_PORT, name], join(STORES, "logs", `${slug}.maint.log`), pidFile(slug, "maint"))
    log("صفحة الصيانة تعمل على منفذ المتجر")
  },

  async resume(slug, log) { await killPid(pidFile(slug, "maint")); await this.start(slug, log) },

  async migrate(slug, log) {
    await run("npx", ["medusa", "db:migrate"], log, { cwd: BACKEND, env: { ...storeEnv(slug) } })
  },

  async backup(slug, kind, log) {
    const e = storeEnv(slug)
    const dir = join(BACKUPS, slug); mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const file = join(dir, `${stamp}-${kind}.dump`)
    await run("pg_dump", ["-Fc", "-f", file, e.DATABASE_URL], log)
    const uploads = join(BACKEND, "static", slug)
    if (existsSync(uploads)) await run("tar", ["-czf", file.replace(/\.dump$/, ".static.tgz"), "-C", join(BACKEND, "static"), slug], log)
    log(`نسخة ${kind}: ${file.split("/").pop()} (${statSync(file).size} بايت)`)
    return { file, size: statSync(file).size }
  },

  async restore(slug, file, log) {
    if (!existsSync(file)) throw new Error("ملف النسخة غير موجود")
    const e = storeEnv(slug)
    await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "-d", e.DATABASE_URL, file], log)
    const tgz = file.replace(/\.dump$/, ".static.tgz")
    if (existsSync(tgz)) await run("tar", ["-xzf", tgz, "-C", join(BACKEND, "static")], log)
  },

  async remove(slug, log) {
    await killStore(slug); await killPid(pidFile(slug, "maint"))
    const e = storeEnv(slug)
    const dest = join(ARCHIVE, `${slug}-${new Date().toISOString().replace(/[:.]/g, "-")}`); mkdirSync(dest, { recursive: true })
    for (const [src, name] of [[join(ROOT, "clients", slug), "client"], [join(STORES, `${slug}.env`), `${slug}.env`], [join(BACKEND, "static", slug), "static"]] as const) {
      if (existsSync(src)) { cpSync(src, join(dest, name), { recursive: true }); rmSync(src, { recursive: true, force: true }) }
    }
    if (e.DATABASE_URL) {
      const u = new URL(e.DATABASE_URL); const db = u.pathname.slice(1); u.pathname = "/postgres"
      const c = new pg.Client({ connectionString: u.toString() }); await c.connect()
      await c.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid <> pg_backend_pid()`, [db])
      await c.query(`drop database if exists "${db.replace(/"/g, "")}"`); await c.end()
      log(`حُذفت القاعدة ${db}`)
    }
    log(`الأرشيف: ${dest.split("/").slice(-2).join("/")}`)
  },

  async stats(slug) {
    const e = storeEnv(slug)
    if (!e.DATABASE_URL) return null
    const c = new pg.Client({ connectionString: e.DATABASE_URL, statement_timeout: 5000 } as any)
    try {
      await c.connect()
      await c.query("set default_transaction_read_only = on")
      const { rows } = await c.query(`select count(*)::int as orders, coalesce(sum((s.totals->>'current_order_total')::numeric),0)::float as sales
        from "order" o join order_summary s on s.order_id=o.id and s.version=o.version and s.deleted_at is null
        where o.deleted_at is null and o.status not in ('canceled','draft') and o.is_draft_order=false and (o.created_at at time zone 'Asia/Muscat')::date = (now() at time zone 'Asia/Muscat')::date`)
      return rows[0]
    } catch { return null } finally { await c.end().catch(() => {}) }
  },

  async logs(slug, lines = 80) {
    const f = join(STORES, "logs", `${slug}.log`)
    if (!existsSync(f)) return ""
    return readFileSync(f, "utf8").replace(/\x1b\[[0-9;]*m/g, "").split("\n").slice(-lines).join("\n")
  },

  /** تراجع إنشاء فاشل: إيقاف، حذف القاعدة، وإزالة المجلد والبيئة (بلا أرشفة — لم يُطلق بعد) */
  async rollback(slug, log) {
    await killStore(slug)
    const e = storeEnv(slug)
    if (e.DATABASE_URL) {
      const u = new URL(e.DATABASE_URL); const db = u.pathname.slice(1); u.pathname = "/postgres"
      const c = new pg.Client({ connectionString: u.toString() }); await c.connect()
      await c.query(`drop database if exists "${db.replace(/"/g, "")}"`).catch(() => {}); await c.end()
    }
    for (const p of [join(ROOT, "clients", slug), join(STORES, `${slug}.env`), join(BACKEND, "static", slug)]) rmSync(p, { recursive: true, force: true })
    log("تراجع: أُزيلت القاعدة والمجلد والبيئة")
  },
}

export { renameSync }
