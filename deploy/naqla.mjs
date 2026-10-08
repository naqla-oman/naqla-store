#!/usr/bin/env node
// أداة تشغيل منصة نقلة على الخادم (Docker). يستعملها منفّذ لوحة نقلة (السائق docker) والأوامر اليدوية عبر deploy/naqla.sh.
// تعمل حيث يتوفر docker CLI والمستودع في مساره على الخادم (/opt/naqla) — داخل حاوية المنفّذ عادةً.
//
//   store <slug> [--domain d] [--admin-email e]   نشر متجر كاملاً (قابل للتكرار): البيئة، القاعدة، الخلفية والترحيل والبذرة،
//                                                   الترجمات، الأدمن، مفتاح النشر، بناء الواجهة، الموقع في Caddy
//   storefront <slug>     إعادة بناء الواجهة وتشغيلها (بعد تغيير الهوية أو الكود)
//   start|stop|pause|resume|migrate|ready|logs|remove|reset-link <slug>
//   backup <slug> [kind]  ← سطر JSON {file,size}؛  backup-all [kind]؛  restore <slug> <file>
//   build-backend | build-console | up-base | status | console-admin <email> [--reset-totp] [--password p] | register <slug>
import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// كل ما تنشئه الأداة (البيئات والنسخ الاحتياطية وفيها بيانات الزبائن) لمالكه فقط
process.umask(0o077)
const DEPLOY = dirname(fileURLToPath(import.meta.url))
const ROOT = join(DEPLOY, "..")
const STORES = join(ROOT, ".stores")
const DATA = join(ROOT, "data")
const BACKUPS = join(ROOT, ".backups")
const ARCHIVE = join(ROOT, ".archive")
const CLIENTS = join(ROOT, "clients")

const fail = (m) => { console.error(`✖ ${m}`); process.exit(1) }
const say = (m) => console.log(m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readEnv = (f) => existsSync(f)
  ? Object.fromEntries(readFileSync(f, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
  : {}
const platform = () => readEnv(join(DEPLOY, ".env"))
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined }
const svcOf = (slug) => slug.replace(/[^a-z0-9-]/g, "-")
const envFile = (slug) => join(STORES, `${slug}.prod.env`)
const dbOf = (slug) => `naqla_${slug.replace(/-/g, "_")}`
const checkSlug = (slug) => { if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug ?? "")) fail(`اسم متجر غير صالح «${slug ?? ""}»`); return slug }

/** تشغيل أمر بمخرجات حيّة (ولا تظهر الأسرار المعروفة في السجل) */
function run(cmd, args, { input, quiet = false, capture = false, env } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] })
    let out = ""
    const take = (b) => {
      const s = b.toString(); out += s
      if (!quiet && !capture) process.stdout.write(s.replace(/(PASSWORD|SECRET|TOKEN|KEY)=\S+/g, "$1=••••"))
    }
    p.stdout.on("data", take); p.stderr.on("data", take)
    if (input) { p.stdin.end(input) }
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(Object.assign(new Error(`${cmd} ${args.slice(0, 3).join(" ")} → ${code}\n${out.slice(-1500)}`), { out }))))
  })
}

// ===== compose: الأساس + ملف كل متجر =====
const storeFiles = () => (existsSync(join(DEPLOY, "stores")) ? readdirSync(join(DEPLOY, "stores")).filter((f) => f.endsWith(".compose.yml")).sort() : [])
const composeArgs = () => ["compose", "-p", "naqla", "--project-directory", DEPLOY, "--env-file", join(DEPLOY, ".env"), "-f", join(DEPLOY, "docker-compose.yml"), ...storeFiles().flatMap((f) => ["-f", join(DEPLOY, "stores", f)])]
const compose = (args, opts) => run("docker", [...composeArgs(), ...args], opts)
const psql = (sql, db = "postgres") => compose(["exec", "-T", "postgres", "psql", "-U", "naqla", "-d", db, "-tAc", sql], { capture: true }).then((o) => o.trim())
// البناء عبر وكيل إن وُجد في البيئة (بيئات الاختبار)؛ لا أثر على الخادم
const proxyArgs = () => ["HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy"].filter((k) => process.env[k]).flatMap((k) => ["--build-arg", `${k}=${process.env[k]}`])

// ===== الصور =====
async function buildBackend() { say("▶ بناء صورة الخلفية (naqla-backend)…"); await run("docker", ["build", ...proxyArgs(), "-f", "deploy/backend.Dockerfile", "-t", "naqla-backend", "."]); await pruneBuilds() }
async function buildConsole() { say("▶ بناء صورة لوحة نقلة (naqla-console)…"); await run("docker", ["build", ...proxyArgs(), "-f", "deploy/console.Dockerfile", "-t", "naqla-console", "."]); await pruneBuilds() }
/**
 * بعد كل بناء: الصور القديمة بلا وسم (أُزيح وسمها لصورة أحدث) وذاكرة البناء فوق 3GB — قرص الخادم 40GB،
 * وذاكرة البناء وحدها تجاوزت 20GB في اختبار متجرين قبل هذا التنظيف
 */
async function pruneBuilds() {
  await run("docker", ["image", "prune", "-f"], { quiet: true }).catch(() => {})
  await run("docker", ["builder", "prune", "-f", "--max-used-space", "3gb"], { quiet: true }).catch(() => {})
}
const imageExists = (name) => run("docker", ["image", "inspect", name], { quiet: true }).then(() => true, () => false)

// ===== نطاقات المتجر =====
/** نطاق فرعي للمنصة: <slug>.<PLATFORM_DOMAIN> وخادمه api-<slug>.<PLATFORM_DOMAIN> (يغطيهما سجل * واحد)؛ دومين العميل: api.<domain> */
function domainsOf(slug, domain) {
  const p = platform().PLATFORM_DOMAIN
  const site = (domain || `${slug}.${p}`).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(site)) fail(`نطاق غير صالح «${site}»`)
  const api = p && site === `${slug}.${p}` ? `api-${slug}.${p}` : `api.${site}`
  return { site, api, www: p && site.endsWith(`.${p}`) ? null : `www.${site}` }
}

// ===== ملفات المتجر (خارج Git) =====
function writeStoreFiles(slug, opts = {}) {
  if (!existsSync(join(CLIENTS, slug, "store.json"))) fail(`لا يوجد clients/${slug}/store.json`)
  const pf = platform()
  if (!pf.POSTGRES_PASSWORD) fail("POSTGRES_PASSWORD غير موجود في deploy/.env — شغّل deploy/install.sh أولاً")
  const prev = readEnv(envFile(slug))
  const d = opts.domain || prev.STORE_DOMAIN ? domainsOf(slug, opts.domain || prev.STORE_DOMAIN) : domainsOf(slug)
  const svc = svcOf(slug)
  const strong = (v, n = 32) => typeof v === "string" && v.length >= n
  const secret = (k, bytes) => (strong(prev[k]) ? prev[k] : randomBytes(bytes).toString("base64url"))
  const site = `https://${d.site}`, api = `https://${d.api}`
  const origins = [site, ...(d.www ? [`https://${d.www}`] : [])].join(",")
  const env = {
    STORE: slug,
    NODE_ENV: "production",
    // أسرار إنتاج مستقلة عن التطوير؛ تبقى عند إعادة التشغيل حتى لا تبطل الجلسات والأسرار المشفّرة
    JWT_SECRET: secret("JWT_SECRET", 48),
    COOKIE_SECRET: secret("COOKIE_SECRET", 48),
    REVALIDATE_SECRET: secret("REVALIDATE_SECRET", 32),
    SETTINGS_ENCRYPTION_KEY: secret("SETTINGS_ENCRYPTION_KEY", 32),
    PHONE_AUTH_SECRET: secret("PHONE_AUTH_SECRET", 32),
    MEDUSA_FF_TRANSLATION: "true",
    // ssl_mode=disable: Medusa يفعّل SSL لأي قاعدة ليست localhost، وPostgres الداخلي (شبكة Docker الخاصة) بلا SSL
    DATABASE_URL: `postgres://naqla:${pf.POSTGRES_PASSWORD}@postgres:5432/${dbOf(slug)}?ssl_mode=disable`,
    REDIS_URL: "redis://redis:6379",
    MEDUSA_BACKEND_URL: api,
    MEDUSA_PUBLIC_URL: api,
    STOREFRONT_URL: site,
    STOREFRONT_INTERNAL_URL: `http://storefront-${svc}:8000`,
    NEXT_PUBLIC_BASE_URL: site,
    STORE_CORS: origins,
    ADMIN_CORS: api,
    AUTH_CORS: `${origins},${api}`,
    STORE_DOMAIN: d.site,
    STORE_API_DOMAIN: d.api,
    ADMIN_EMAIL: opts.adminEmail || prev.ADMIN_EMAIL || (() => { try { return JSON.parse(readFileSync(join(CLIENTS, slug, "store.json"), "utf8")).contact?.email } catch { return "" } })() || `admin@${d.site}`,
    ADMIN_PASSWORD: prev.ADMIN_PASSWORD || randomBytes(12).toString("base64url"),
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: prev.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
  }
  const keep = Object.entries(prev).filter(([k]) => !(k in env))
  mkdirSync(STORES, { recursive: true })
  writeFileSync(envFile(slug), [`# إنتاج «${slug}» — أنشأه deploy/naqla.mjs (خارج Git، صلاحيات 600)`, ...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...keep.map(([k, v]) => `${k}=${v}`), ""].join("\n"), { mode: 0o600 })
  for (const sub of ["uploads", "private"]) mkdirSync(join(DATA, slug, sub), { recursive: true })

  mkdirSync(join(DEPLOY, "stores"), { recursive: true })
  writeFileSync(join(DEPLOY, "stores", `${slug}.compose.yml`), `# مولَّد بـ deploy/naqla.mjs — خارج Git. المسارات نسبةً إلى deploy/
services:
  backend-${svc}:
    image: naqla-backend
    restart: unless-stopped
    logging: { driver: local, options: { max-size: 20m, max-file: "5" } }
    env_file: ../.stores/${slug}.prod.env
    environment:
      TZ: Asia/Muscat
    volumes:
      - ../clients:/app/clients:ro
      - ../data/${slug}/uploads:/data/uploads
      - ../data/${slug}/private:/data/private
    mem_limit: 768m
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:9000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 180s

  storefront-${svc}:
    image: naqla-storefront-${slug}
    restart: unless-stopped
    logging: { driver: local, options: { max-size: 20m, max-file: "5" } }
    env_file: ../.stores/${slug}.prod.env
    environment:
      MEDUSA_BACKEND_URL: http://backend-${svc}:9000
      TZ: Asia/Muscat
    mem_limit: 384m
    depends_on:
      backend-${svc}: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 90s
`)
  writeSite(slug, false)
  return { env, d, svc }
}

const MAINT_HTML = (name) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} — صيانة</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F7F8;font-family:system-ui,sans-serif;color:#0B1B2B;text-align:center}main{padding:24px}h1{font-size:24px}p{color:#5B6B78}</style></head><body><main><h1>${name}</h1><p>نُجري تحديثات على المتجر، ونعود قريباً.</p></main></body></html>`

/** موقع المتجر في Caddy — أو صفحة الصيانة (503) أثناء الإيقاف المؤقت */
function writeSite(slug, maintenance) {
  const e = readEnv(envFile(slug)), svc = svcOf(slug)
  const site = e.STORE_DOMAIN, api = e.STORE_API_DOMAIN
  const hosts = [site, ...(platform().PLATFORM_DOMAIN && site.endsWith(`.${platform().PLATFORM_DOMAIN}`) ? [] : [`www.${site}`])].join(", ")
  const name = (() => { try { return JSON.parse(readFileSync(join(CLIENTS, slug, "store.json"), "utf8")).name } catch { return slug } })()
  const store = maintenance
    ? `\theader Content-Type "text/html; charset=utf-8"\n\theader Retry-After "600"\n\trespond \`${MAINT_HTML(name).replace(/`/g, "")}\` 503`
    : `\treverse_proxy storefront-${svc}:8000`
  const backend = maintenance ? `\trespond "maintenance" 503` : `\treverse_proxy backend-${svc}:9000`
  mkdirSync(join(DEPLOY, "sites"), { recursive: true })
  writeFileSync(join(DEPLOY, "sites", `${slug}.caddy`), `# مولَّد بـ deploy/naqla.mjs — خارج Git${maintenance ? " (صيانة)" : ""}
${hosts} {
\timport security
\timport access_log
\theader X-Frame-Options "SAMEORIGIN"
\theader Content-Security-Policy "frame-ancestors 'self'"
${store}
}

${api} {
\timport security
\timport access_log
\t# اللوحة (/app) والـAPI: لا تضمين في إطار إطلاقاً (Medusa يقدّم /app خارج middlewares)
\theader X-Frame-Options "DENY"
\theader Content-Security-Policy "frame-ancestors 'none'"
${backend}
}
`)
}
const reloadCaddy = () => compose(["exec", "-T", "caddy", "caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"], { quiet: true }).catch((e) => say(`⚠ إعادة تحميل Caddy: ${e.message.split("\n")[0]}`))

// ===== الحالة =====
const containerOf = (service) => compose(["ps", "-q", service], { capture: true }).then((o) => o.trim().split("\n")[0] || "")
async function healthOf(service) {
  const id = await containerOf(service)
  if (!id) return "absent"
  return (await run("docker", ["inspect", "-f", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", id], { capture: true })).trim()
}
async function waitHealthy(service, minutes = 8) {
  const until = Date.now() + minutes * 60_000
  let last = ""
  while (Date.now() < until) {
    const h = await healthOf(service)
    if (h !== last) { say(`  ${service}: ${h}`); last = h }
    if (h === "healthy") return true
    if (h === "exited" || h === "dead") break
    await sleep(5000)
  }
  say((await compose(["logs", "--tail", "40", service], { capture: true }).catch(() => "")).replace(/(PASSWORD|SECRET|TOKEN|KEY)=\S+/g, "$1=••••"))
  return false
}
async function ready(slug) {
  const svc = svcOf(slug)
  return (await healthOf(`backend-${svc}`)) === "healthy" && (await healthOf(`storefront-${svc}`)) === "healthy"
}

// ===== النشر =====
async function ensureDb(slug) {
  const db = dbOf(slug)
  if ((await psql(`select 1 from pg_database where datname='${db}'`)) !== "1") {
    await psql(`create database "${db}"`)
    say(`  القاعدة ${db} أُنشئت`)
  }
}
const backendExec = (slug, args, opts) => compose(["exec", "-T", `backend-${svcOf(slug)}`, ...args], opts)

async function buildStorefront(slug) {
  const e = readEnv(envFile(slug)), svc = svcOf(slug)
  if (!e.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) fail("لا يوجد مفتاح النشر بعد — شغّل store أولاً")
  const id = await containerOf(`backend-${svc}`)
  if (!id) fail(`الخلفية backend-${svc} لا تعمل — تجهيز الصفحات يحتاجها أثناء البناء`)
  const ip = (await run("docker", ["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", id], { capture: true })).trim().split(" ")[0]
  say(`▶ بناء واجهة «${slug}» (naqla-storefront-${slug}) — الخلفية ${ip}`)
  // --network host + --add-host: عنوان الخلفية وقت البناء هو نفسه وقت التشغيل (http://backend-<svc>:9000)
  await run("docker", ["build", ...proxyArgs(), "--network", "host", "--add-host", `backend-${svc}:${ip}`,
    "--build-arg", `STORE=${slug}`, "--build-arg", `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${e.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}`,
    "--build-arg", `NEXT_PUBLIC_BASE_URL=${e.NEXT_PUBLIC_BASE_URL}`, "--build-arg", `MEDUSA_BACKEND_URL=http://backend-${svc}:9000`,
    "--build-arg", `MEDUSA_PUBLIC_URL=${e.MEDUSA_PUBLIC_URL}`,
    "-f", "deploy/storefront.Dockerfile", "-t", `naqla-storefront-${slug}`, "."])
  await pruneBuilds()
}

async function deployStore(slug) {
  checkSlug(slug)
  say(`\n▶ نشر «${slug}»`)
  const { env, d, svc } = writeStoreFiles(slug, { domain: arg("--domain"), adminEmail: arg("--admin-email") })
  say(`  ${d.site} (الواجهة) و ${d.api} (الخادم ولوحة التاجر)`)
  if (!(await imageExists("naqla-backend"))) await buildBackend()
  await ensureDb(slug)
  say("▶ الخلفية: الترحيل والبذرة ثم التشغيل…")
  await compose(["up", "-d", `backend-${svc}`])
  if (!(await waitHealthy(`backend-${svc}`))) fail("لم تجهز الخلفية")
  if (existsSync(join(CLIENTS, slug, "locales", "en.json"))) {
    say("▶ الترجمات (locales/en.json)…")
    await backendExec(slug, ["npx", "medusa", "exec", "./src/scripts/i18n-sync.js"]).catch((e) => say(`⚠ الترجمات: ${e.message.split("\n")[0]}`))
  }
  say("▶ حساب المسؤول…")
  await backendExec(slug, ["npx", "medusa", "user", "-e", env.ADMIN_EMAIL, "-p", env.ADMIN_PASSWORD], { quiet: true }).catch((e) => {
    if (!/already exists|exists/i.test(e.out ?? "")) throw e
  })
  const pk = await psql(`select token from api_key where type='publishable' and revoked_at is null and deleted_at is null order by created_at limit 1`, dbOf(slug))
  if (!/^pk_/.test(pk)) fail("لم يُعثر على مفتاح النشر في القاعدة (البذرة؟)")
  if (pk !== env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    const f = envFile(slug)
    writeFileSync(f, readFileSync(f, "utf8").replace(/^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=.*$/m, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${pk}`), { mode: 0o600 })
  }
  await buildStorefront(slug)
  await compose(["up", "-d", `storefront-${svc}`])
  if (!(await waitHealthy(`storefront-${svc}`))) fail("لم تجهز الواجهة")
  writeSite(slug, false)
  await reloadCaddy()
  // في لوحة نقلة (إن لم يكن مسجّلاً — المتاجر التي تنشئها اللوحة مسجّلة أصلاً)
  await register(slug).catch((e) => say(`⚠ التسجيل في لوحة نقلة: ${e.message.split("\n")[0]}`))
  say(`\n✔ «${slug}» يعمل\n  المتجر:      https://${d.site}\n  لوحة التاجر: https://${d.api}/app\n  المسؤول:     ${env.ADMIN_EMAIL} (كلمة المرور في .stores/${slug}.prod.env — ADMIN_PASSWORD)`)
}

// ===== النسخ الاحتياطي =====
async function backup(slug, kind = "manual") {
  checkSlug(slug)
  const dir = join(BACKUPS, slug); mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const file = join(dir, `${stamp}-${kind}.dump`)
  // pg_dump داخل حاوية Postgres ← الملف في .backups على الخادم
  const out = await new Promise((resolve, reject) => {
    const p = spawn("docker", [...composeArgs(), "exec", "-T", "postgres", "pg_dump", "-U", "naqla", "-Fc", dbOf(slug)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] })
    const chunks = []; let err = ""
    p.stdout.on("data", (b) => chunks.push(b)); p.stderr.on("data", (b) => { err += b })
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`pg_dump → ${code}: ${err.slice(-300)}`))))
  })
  writeFileSync(file, out, { mode: 0o600 })
  const uploads = join(DATA, slug, "uploads")
  if (existsSync(uploads)) await run("tar", ["-czf", file.replace(/\.dump$/, ".uploads.tgz"), "-C", join(DATA, slug), "uploads"], { quiet: true })
  const size = statSync(file).size
  say(JSON.stringify({ file, size }))
  return { file, size }
}
/** يُبقي آخر 14 نسخة يومية لكل متجر (النسخ اليدوية وما قبل التحديث لا تُحذف) */
function prune(slug, keep = 14) {
  const dir = join(BACKUPS, slug)
  if (!existsSync(dir)) return
  const daily = readdirSync(dir).filter((f) => f.endsWith("-daily.dump")).sort()
  for (const f of daily.slice(0, Math.max(0, daily.length - keep))) {
    rmSync(join(dir, f), { force: true }); rmSync(join(dir, f.replace(/\.dump$/, ".uploads.tgz")), { force: true })
  }
}
async function restore(slug, file) {
  checkSlug(slug)
  if (!file || !existsSync(file)) fail("ملف النسخة غير موجود")
  const svc = svcOf(slug)
  await compose(["stop", `storefront-${svc}`, `backend-${svc}`]).catch(() => {})
  await psql(`select pg_terminate_backend(pid) from pg_stat_activity where datname='${dbOf(slug)}' and pid <> pg_backend_pid()`)
  await compose(["exec", "-T", "postgres", "pg_restore", "-U", "naqla", "--clean", "--if-exists", "--no-owner", "-d", dbOf(slug)], { input: readFileSync(file) })
  const tgz = file.replace(/\.dump$/, ".uploads.tgz")
  if (existsSync(tgz)) await run("tar", ["-xzf", tgz, "-C", join(DATA, slug)], { quiet: true })
  say("✔ استُعيدت القاعدة والصور")
}

/** نقل إلى الأرشيف — داخل المنفّذ تقع clients/ و.archive/ على تركيبين مختلفين فيُرفض rename (EXDEV): نسخ ثم حذف */
function moveTo(src, dest) {
  try { renameSync(src, dest) } catch (e) {
    if (e.code !== "EXDEV") throw e
    cpSync(src, dest, { recursive: true }); rmSync(src, { recursive: true, force: true })
  }
}
async function remove(slug) {
  checkSlug(slug)
  const svc = svcOf(slug)
  await compose(["rm", "-sf", `storefront-${svc}`, `backend-${svc}`]).catch(() => {})
  const dest = join(ARCHIVE, `${slug}-${new Date().toISOString().replace(/[:.]/g, "-")}`); mkdirSync(dest, { recursive: true })
  for (const [src, name] of [[join(CLIENTS, slug), "client"], [envFile(slug), `${slug}.prod.env`], [join(DATA, slug), "data"], [join(DEPLOY, "stores", `${slug}.compose.yml`), "compose.yml"], [join(DEPLOY, "sites", `${slug}.caddy`), "site.caddy"]]) {
    if (existsSync(src)) moveTo(src, join(dest, name))
  }
  await psql(`select pg_terminate_backend(pid) from pg_stat_activity where datname='${dbOf(slug)}' and pid <> pg_backend_pid()`)
  await psql(`drop database if exists "${dbOf(slug)}"`)
  await run("docker", ["image", "rm", "-f", `naqla-storefront-${slug}`], { quiet: true }).catch(() => {})
  await reloadCaddy()
  say(`✔ حُذف «${slug}» — الأرشيف: ${dest}`)
}

// ===== لوحة نقلة =====
async function consoleExec(args, opts) { return compose(["exec", "-T", "console-worker", ...args], opts) }
async function register(slug) {
  checkSlug(slug)
  const e = readEnv(envFile(slug))
  if (!e.STORE_DOMAIN) fail(`«${slug}» غير منشور بعد`)
  const s = JSON.parse(readFileSync(join(CLIENTS, slug, "store.json"), "utf8"))
  const esc = (v) => `'${String(v ?? "").replace(/'/g, "''")}'`
  await psql(`insert into stores (slug, name, template, status, domain, phone, email, health, meta) values (${esc(slug)}, ${esc(s.name)}, ${esc(s.template ?? "imported")}, 'running', ${esc(e.STORE_DOMAIN)}, ${esc(s.contact?.whatsapp ?? s.contact?.phone ?? "")}, ${esc(e.ADMIN_EMAIL)}, 'ok', '{"imported":true}'::jsonb)
    on conflict (slug) do update set domain=excluded.domain, updated_at=now()`, "naqla_console")
  say(`✔ «${slug}» مسجّل في لوحة نقلة`)
}

// ===== الأوامر =====
const [cmd, a1, a2] = process.argv.slice(2).filter((x, i, all) => !x.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--")))
const svc = a1 ? svcOf(a1) : ""
try {
  switch (cmd) {
    case "build-backend": await buildBackend(); break
    case "build-console": await buildConsole(); break
    case "up-base": await compose(["up", "-d", "caddy", "postgres", "redis", "console", "console-worker"]); break
    case "status": await compose(["ps", "--format", "table {{.Service}}\t{{.Status}}"]); break
    case "store": await deployStore(a1); break
    case "storefront": checkSlug(a1); await buildStorefront(a1); await compose(["up", "-d", "--force-recreate", `storefront-${svc}`]); if (!(await waitHealthy(`storefront-${svc}`))) fail("لم تجهز الواجهة"); break
    case "start": checkSlug(a1); await compose(["up", "-d", `backend-${svc}`, `storefront-${svc}`]); writeSite(a1, false); await reloadCaddy(); break
    case "stop": checkSlug(a1); await compose(["stop", `storefront-${svc}`, `backend-${svc}`]); break
    case "pause": checkSlug(a1); writeSite(a1, true); await reloadCaddy(); await compose(["stop", `storefront-${svc}`, `backend-${svc}`]); say("✔ صفحة الصيانة تعمل"); break
    case "resume": checkSlug(a1); await compose(["up", "-d", `backend-${svc}`, `storefront-${svc}`]); if (!(await waitHealthy(`storefront-${svc}`))) fail("لم يجهز"); writeSite(a1, false); await reloadCaddy(); break
    // الترحيلات تعمل عند كل إقلاع للخلفية (CMD)؛ مع صورة جديدة: إعادة إنشاء الحاوية
    case "migrate": checkSlug(a1); await compose(["up", "-d", "--force-recreate", `backend-${svc}`]); if (!(await waitHealthy(`backend-${svc}`))) fail("لم تجهز الخلفية"); break
    case "ready": checkSlug(a1); { const ok = await ready(a1); say(ok ? "ready" : "not-ready"); process.exitCode = ok ? 0 : 1 } break
    case "logs": checkSlug(a1); say((await compose(["logs", "--no-color", "--tail", String(Number(a2) || 80), `backend-${svc}`, `storefront-${svc}`], { capture: true })).replace(/(PASSWORD|SECRET|TOKEN|KEY)=\S+/g, "$1=••••")); break
    case "backup": await backup(a1, a2 || "manual"); break
    case "backup-all": for (const f of storeFiles()) { const s = f.replace(/\.compose\.yml$/, ""); await backup(s, a1 || "daily").catch((e) => say(`✖ ${s}: ${e.message}`)); prune(s) } break
    case "restore": await restore(a1, a2); break
    case "remove": await remove(a1); break
    case "reset-link": {
      checkSlug(a1)
      const e = readEnv(envFile(a1))
      const out = await backendExec(a1, ["npx", "medusa", "exec", "./src/scripts/admin-reset-link.js"], { capture: true, env: {} })
      const token = (out.match(/RESET_TOKEN=(\S+)/) ?? [])[1]
      if (!token) fail("لم يُولَّد رمز تعيين كلمة المرور")
      say(`RESET_URL=https://${e.STORE_API_DOMAIN}/app/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(e.ADMIN_EMAIL)}`)
      break
    }
    case "console-admin": {
      const email = a1
      if (!email) fail("الاستخدام: console-admin <email> [--reset-totp]")
      // مخطط القاعدة + المدير (كلمة مرور وسر TOTP ورمز QR) — يطبع في الطرفية فقط
      await consoleExec(["npx", "tsx", "scripts/setup.ts", email, ...(process.argv.includes("--reset-totp") ? ["--reset-totp"] : []), ...(arg("--password") ? ["--password", arg("--password")] : [])])
      break
    }
    case "register": await register(a1); break
    default:
      say(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 11).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"))
      process.exitCode = cmd ? 1 : 0
  }
} catch (e) {
  fail(e.message)
}
