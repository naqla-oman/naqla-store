// pnpm store:setup <slug> — قاعدة بيانات جديدة + migrate + البذرة + الصور + مستخدم أدمن
// يحفظ بيئة المتجر في .stores/<slug>.env (خارج Git) لتشغيله بـ pnpm store:dev <slug>
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { BACKEND, CLIENTS, STORES, c, fail, listStoreEnvs, readEnv, run, slugArg, storeEnvFile } from "./lib.mjs"

const slug = slugArg()
if (!existsSync(join(CLIENTS, slug, "store.json"))) fail(`لا يوجد clients/${slug}/store.json — ابدئي بـ pnpm store:new ${slug}`)
const envFile = storeEnvFile(slug)
if (existsSync(envFile) && !process.argv.includes("--force")) {
  fail(`المتجر مُعدّ مسبقاً (${envFile}). لإعادة الإعداد على قاعدة جديدة: pnpm store:setup ${slug} --force`)
}

// قاعدة البيانات: نفس خادم/مستخدم DATABASE_URL في apps/backend/.env باسم naqla_<slug>
const base = readEnv(join(BACKEND, ".env")).DATABASE_URL || process.env.DATABASE_URL
if (!base) fail("DATABASE_URL غير موجود في apps/backend/.env (يُستخدم خادمه ومستخدمه لإنشاء قاعدة المتجر)")
const dbName = `naqla_${slug.replace(/-/g, "_")}`
const dbUrl = (() => { const u = new URL(base); u.pathname = `/${dbName}`; return u.toString() })()

// المنافذ: محفوظة إن أُعدّ سابقاً، وإلا التالي غير المستخدم (9000/8000، 9001/8001…)
const prev = readEnv(envFile)
// منخفضة: الأرقام في store.json لاتينية (كالأسعار والأعداد المحسوبة) — تحذير إن عادت الأرقام الهندية
{
  const raw = readFileSync(join(CLIENTS, slug, "store.json"), "utf8")
  const mixed = raw.match(/[٠-٩]/g)
  if (mixed) console.log(c.y(`تنبيه: ${mixed.length} رقماً هندياً (٠-٩) في clients/${slug}/store.json — وحّديها لاتينية (0-9) كالأسعار`))
}
const taken = new Set(listStoreEnvs().filter((f) => f !== `${slug}.env`).map((f) => readEnv(join(STORES, f)).BACKEND_PORT))
let i = 0
while (taken.has(String(9000 + i))) i++
const backendPort = prev.BACKEND_PORT || String(9000 + i)
const storefrontPort = prev.STOREFRONT_PORT || String(8000 + Number(backendPort) - 9000)
const backendUrl = `http://localhost:${backendPort}`
const storefrontUrl = `http://localhost:${storefrontPort}`

// C3: أسرار مستقلة لكل متجر (تبقى عند إعادة الإعداد حتى لا تبطل الجلسات القائمة)
const strong = (v) => typeof v === "string" && v.length >= 32
const env = {
  STORE: slug,
  JWT_SECRET: strong(prev.JWT_SECRET) ? prev.JWT_SECRET : randomBytes(48).toString("base64url"),
  COOKIE_SECRET: strong(prev.COOKIE_SECRET) ? prev.COOKIE_SECRET : randomBytes(48).toString("base64url"),
  // H1: سر مشترك بين الخلفية والواجهة لإبطال ذاكرة الواجهة
  REVALIDATE_SECRET: strong(prev.REVALIDATE_SECRET) ? prev.REVALIDATE_SECRET : randomBytes(32).toString("base64url"),
  DATABASE_URL: dbUrl,
  MEDUSA_BACKEND_URL: backendUrl,
  STOREFRONT_URL: storefrontUrl,
  // H6: Redis مشترك بين المتاجر (البادئة لكل متجر في medusa-config)؛ بدونه تعمل الوحدات في الذاكرة
  ...((process.env.REDIS_URL || readEnv(join(BACKEND, ".env")).REDIS_URL) ? { REDIS_URL: process.env.REDIS_URL || readEnv(join(BACKEND, ".env")).REDIS_URL } : {}),
  STORE_CORS: storefrontUrl,
  ADMIN_CORS: `${backendUrl}`,
  AUTH_CORS: `${storefrontUrl},${backendUrl}`,
}

console.log(c.b(`\n▶ إعداد المتجر «${slug}» — القاعدة ${dbName}، الخلفية ${backendPort}، الواجهة ${storefrontPort}\n`))

console.log(c.d("1/3 إنشاء قاعدة البيانات…"))
await run("npx", ["medusa", "db:create", "--db", dbName, "--no-interactive"], { cwd: BACKEND, env: { ...env, DATABASE_URL: base } }).catch((e) => {
  if (!/already exists/i.test(e.out ?? "")) fail(`تعذّر إنشاء القاعدة:\n${e.out ?? e.message}`)
})

console.log(c.d("2/3 الترحيلات + البذرة + الدفع + الضريبة + الصور + المستويات…"))
const out = await run("npx", ["medusa", "db:migrate"], { cwd: BACKEND, env }).catch((e) => fail(`فشل الترحيل:\n${(e.out ?? e.message).slice(-3000)}`))
// M12: مزوّدو الدفع حسب features والمسجّل فعلاً (ثواني بعد تفعيله يظهر دون تدخّل)
await run("npx", ["medusa", "exec", "./src/scripts/sync-payment-providers.ts"], { cwd: BACKEND, env: { ...process.env, ...env } }).catch(() => console.log(c.y("تنبيه: تعذّرت مزامنة مزوّدي الدفع")))
const pk = (out.match(/Publishable key: (pk_[a-f0-9]+)/) || [])[1] || prev.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
if (!pk) fail("لم يُعثر على مفتاح النشر في مخرجات البذرة — هل كانت القاعدة مستخدمة سابقاً؟ استخدمي قاعدة جديدة")
for (const line of out.split("\n").filter((l) => /checkout-setup|product-images|loyalty-tiers|tax-inclusive|Seeded/.test(l))) {
  console.log("  " + line.replace(/\x1b\[[0-9;]*m/g, "").replace(/^\s*info:\s*/, ""))
}

console.log(c.d("3/3 مستخدم الأدمن…"))
const adminEmail = prev.ADMIN_EMAIL || `admin@${slug}.local`
const adminPassword = prev.ADMIN_PASSWORD || randomBytes(9).toString("base64url")
await run("npx", ["medusa", "user", "-e", adminEmail, "-p", adminPassword], { cwd: BACKEND, env }).catch((e) => {
  if (!/already exists|exists/i.test(e.out ?? "")) fail(`تعذّر إنشاء الأدمن:\n${e.out ?? e.message}`)
})

mkdirSync(STORES, { recursive: true })
writeFileSync(
  envFile,
  [
    `# بيئة المتجر «${slug}» — أنشأها store:setup (لا تُرفع إلى Git)`,
    ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
    `BACKEND_PORT=${backendPort}`,
    `STOREFRONT_PORT=${storefrontPort}`,
    `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${pk}`,
    `NEXT_PUBLIC_BASE_URL=${storefrontUrl}`,
    `ADMIN_EMAIL=${adminEmail}`,
    `ADMIN_PASSWORD=${adminPassword}`,
    // المفاتيح التي أضافها المسؤول يدوياً (ثواني، واتساب، البريد…) تبقى عند إعادة الإعداد
    ...Object.entries(prev)
      .filter(([k]) => !(k in env) && !["BACKEND_PORT", "STOREFRONT_PORT", "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY", "NEXT_PUBLIC_BASE_URL", "ADMIN_EMAIL", "ADMIN_PASSWORD"].includes(k))
      .map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n")
)

console.log(c.g(`\n✔ المتجر «${slug}» جاهز`))
console.log(`
  التشغيل:        ${c.b(`pnpm store:dev ${slug}`)}
  المتجر:         ${storefrontUrl}
  لوحة التحكم:    ${backendUrl}/app
  الأدمن:         ${adminEmail}  /  ${adminPassword}
  البيئة:         ${envFile}
`)
