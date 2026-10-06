// pnpm test:console [section…] — الاختبار الحاسم للوحة نقلة الرئيسية (قابل للتكرار)
// الأقسام: auth (التالية تُضاف مع كل جزء). يقرأ سر TOTP من قاعدة اللوحة (بيئة التطوير فقط).
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import pg from "pg"

const BASE = process.env.CONSOLE_URL || "http://localhost:7000"
const EMAIL = process.env.CONSOLE_EMAIL || "aouni@naqla.tech"
const PASSWORD = process.env.CONSOLE_PASSWORD || "Console-Test-2026!"
const env = Object.fromEntries(
  readFileSync(new URL("../apps/console/.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
)
const db = new pg.Client({ connectionString: env.CONSOLE_DATABASE_URL })
await db.connect()
export const q = async (s, p = []) => (await db.query(s, p)).rows

let pass = 0, failn = 0
export const ok = (cond, label, extra = "") => { cond ? pass++ : failn++; console.log(`${cond ? "✔" : "✖"} ${label}${extra ? ` — ${extra}` : ""}`) }

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
function totp(secret, step = Math.floor(Date.now() / 30000)) {
  let bits = ""
  for (const ch of secret) bits += B32.indexOf(ch).toString(2).padStart(5, "0")
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step))
  const h = createHmac("sha1", key).update(msg).digest(), o = h[h.length - 1] & 0xf
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0")
}
const ip = () => `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
let lastStep = 0
/** دخول بخطوة TOTP جديدة في كل مرة (منع الإعادة يرفض نفس الخطوة) */
export async function login({ password = PASSWORD, code, step, from = ip() } = {}) {
  const [a] = await q(`select totp_secret, totp_last_step from admins where email=$1`, [EMAIL])
  let s = step ?? Math.floor(Date.now() / 30000)
  if (step === undefined && s <= Number(a.totp_last_step)) s = Number(a.totp_last_step) + 1
  if (step === undefined) lastStep = s
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": from },
    body: JSON.stringify({ email: EMAIL, password, code: code ?? totp(a.totp_secret, s) }),
  })
  return { status: r.status, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0], setCookie: r.headers.get("set-cookie") ?? "", body: await r.json().catch(() => ({})) }
}
export const get = (path, cookie) => fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" })

async function auth() {
  console.log("\n— الدخول بـ TOTP —")
  await q(`update admins set totp_last_step=0 where email=$1`, [EMAIL])
  const noSession = await get("/")
  ok(noSession.status === 307 && /\/login$/.test(noSession.headers.get("location") ?? ""), "بلا جلسة ← /login")
  ok((await login({ password: "wrong-password" })).status === 401, "كلمة مرور خاطئة مرفوضة")
  ok((await login({ code: "000000" })).status === 401, "رمز TOTP خاطئ مرفوض")
  ok((await login({ step: Math.floor(Date.now() / 30000) - 5 })).status === 401, "رمز TOTP منتهٍ (قبل دقيقتين ونصف) مرفوض")
  const good = await login({ step: Math.floor(Date.now() / 30000) })
  ok(good.status === 200 && good.cookie.startsWith("naqla_console_sid="), "كلمة المرور + الرمز الصحيح ← جلسة")
  ok(/HttpOnly/i.test(good.setCookie) && /SameSite=strict/i.test(good.setCookie), "كوكي الجلسة HttpOnly وSameSite=Strict")
  ok((await login({ step: Math.floor(Date.now() / 30000) })).status === 401, "إعادة استخدام نفس الرمز مرفوضة (منع الإعادة)")
  const home = await get("/", good.cookie)
  ok(home.status === 200 && (await home.text()).includes("نظرة عامة"), "الصفحة الرئيسية بالجلسة")
  const lockIp = ip()
  for (let i = 0; i < 5; i++) await login({ password: "x", from: lockIp })
  const locked = await login({ from: lockIp })
  ok(locked.status === 401 && /محاولات كثيرة/.test(locked.body.error ?? ""), "القفل بعد 5 محاولات فاشلة من نفس العنوان", locked.body.error)
  const [{ n }] = await q(`select count(*) n from audit where action='login' and at > now() - interval '2 minutes'`)
  ok(Number(n) >= 8, "سجل العمليات يسجّل كل محاولة", `${n} قيد`)
  const audit = await get("/audit", good.cookie)
  ok(audit.status === 200 && (await audit.text()).includes("audit-row"), "صفحة سجل العمليات")
  const out = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: good.cookie }, redirect: "manual" })
  ok(out.status === 303 && (await get("/", good.cookie)).status === 307, "الخروج يُبطل الجلسة")
}

// ══ الاختبار الحاسم: إنشاء ← تشغيل ← شراء ← إيقاف/استئناف ← نسخة/استعادة ← حذف ══
const ROOT = new URL("..", import.meta.url).pathname
const { existsSync, readdirSync } = await import("node:fs")
const storeEnv = (slug) => { const f = `${ROOT}.stores/${slug}.env`; return existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {} }
let cookie = null
async function session() { if (!cookie) { const r = await login(); cookie = r.cookie } return cookie }
const api = async (method, path, body) => { const r = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: await session() }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitJob(id, label, minutes = 15) {
  const end = Date.now() + minutes * 60_000
  for (;;) {
    const { body: j } = await api("GET", `/api/jobs/${id}`)
    if (j?.status === "done" || j?.status === "failed") { ok(j.status === "done", `${label} (مهمة #${id})`, j.status === "failed" ? `${j.error} | ${j.steps.find((s) => s.status === "failed")?.log?.slice(-3).join(" / ")}` : j.steps.map((s) => s.key).join("→")); return j }
    if (Date.now() > end) { ok(false, `${label}: انتهت المهلة`); return j }
    await sleep(5000)
  }
}
async function storeApi(slug, method, path, body) {
  const e = storeEnv(slug)
  const r = await fetch(`${e.MEDUSA_BACKEND_URL}${path}`, { method, headers: { "Content-Type": "application/json", "x-publishable-api-key": e.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}
/** طلب شراء كامل (الدفع عند الاستلام) عبر واجهة المتجر البرمجية */
async function purchase(slug) {
  const reg = (await storeApi(slug, "GET", "/store/regions")).body.regions[0].id
  const prods = (await storeApi(slug, "GET", `/store/products?limit=50&region_id=${reg}&fields=handle,metadata,*variants,+variants.inventory_quantity`)).body.products
  const v = prods.filter((p) => !p.metadata?.service).flatMap((p) => p.variants).find((x) => (x.inventory_quantity ?? 0) >= 1)
  const cart = (await storeApi(slug, "POST", "/store/carts", { region_id: reg, email: "buyer@example.com" })).body.cart.id
  await storeApi(slug, "POST", `/store/carts/${cart}/line-items`, { variant_id: v.id, quantity: 1 })
  await storeApi(slug, "POST", `/store/carts/${cart}`, { metadata: { payment_channel: "cod" }, shipping_address: { first_name: "زبونة", last_name: "تجريبية", phone: "+96892220011", country_code: "om", province: "om-ma", city: "السيب", address_1: "حي 1" } })
  const so = (await storeApi(slug, "GET", `/store/shipping-options?cart_id=${cart}`)).body.shipping_options.find((o) => o.type?.code === "standard")
  await storeApi(slug, "POST", `/store/carts/${cart}/shipping-methods`, { option_id: so.id })
  const pc = (await storeApi(slug, "POST", "/store/payment-collections", { cart_id: cart })).body.payment_collection.id
  await storeApi(slug, "POST", `/store/payment-collections/${pc}/payment-sessions`, { provider_id: "pp_cod_offline" })
  return (await storeApi(slug, "POST", `/store/carts/${cart}/complete`, {})).body.order
}
const orderCount = async (slug) => { const c = new pg.Client({ connectionString: storeEnv(slug).DATABASE_URL }); await c.connect(); const n = Number((await c.query(`select count(*) n from "order" where deleted_at is null`)).rows[0].n); await c.end(); return n }

function crucialFor(slug, template, name, palette) {
  return async function () {
    console.log(`\n— المتجر «${name}» من قالب ${template} —`)
    await q(`delete from stores where slug=$1 and status in ('deleted','failed')`, [slug])
    const logo = readFileSync(`${ROOT}templates/${template}/icons/icon-512.png`).toString("base64")
    const bad = await api("POST", "/api/stores", { slug: "layan", name, phone: "96891234567", email: "x@y.om", template })
    ok(bad.status === 400, "رمز مستخدم مرفوض", bad.body.error)
    const c = await api("POST", "/api/stores", { slug, name, phone: "96891234567", email: `owner@${slug}.example`, template, palette, font: "hayawi", voice: "f", logo: `data:image/png;base64,${logo}`, domainType: "sub", features: { cod: true, whatsappOrder: true, thawani: false, loyalty: true, loyaltyTiers: true } })
    ok(c.status === 200 && c.body.jobId, "طلب الإنشاء من اللوحة", JSON.stringify(c.body))
    const j = await waitJob(c.body.jobId, "التجهيز كاملاً حتى /ready", 20)
    if (j?.status !== "done") return
    const notify = j.steps.find((s) => s.key === "notify")?.log.join(" ") ?? ""
    ok(/store_ready → \+96891234567/.test(notify) && /reset-password\?token=/.test(notify), "رسالة واتساب للعميل برابط اللوحة ورابط التعيين")
    ok(!/ADMIN_PASSWORD|password=/i.test(JSON.stringify(j.steps)), "لا كلمة مرور في أي رسالة أو سجل خطوة")
    const [row] = await q(`select * from stores where slug=$1`, [slug])
    ok(row.status === "running" && row.health === "ok", "الحالة «يعمل» والصحة /ready")
    const e = storeEnv(slug), sj = JSON.parse(readFileSync(`${ROOT}clients/${slug}/store.json`, "utf8"))
    ok(sj.name === name && sj.theme?.palette === palette && sj.brand?.logo === "logo.png" && sj.features.thawani === false, "الهوية من المعالج في store.json", `${sj.theme?.palette} / ${sj.brand?.logo}`)
    // الواجهة تضبط كوكي المنطقة ثم تحوّل — curl بجرّة كوكي (fetch بلا كوكي يدور في التحويل)
    const { execFileSync } = await import("node:child_process")
    const jar = `/tmp/jar-${slug}`
    const home = (() => { try { execFileSync("curl", ["-s", "-L", "-c", jar, "-b", jar, "-o", "/dev/null", "-m", "200", `${e.STOREFRONT_URL}/om`]); return execFileSync("curl", ["-s", "-L", "-b", jar, "-m", "200", `${e.STOREFRONT_URL}/om`]).toString() } catch { return "" } })()
    ok(home.includes(name) && home.includes("naqla-identity"), "المتجر يعمل بالاسم واللوحة المختارة")
    const o1 = await purchase(slug)
    ok(!!o1?.display_id, "طلب شراء كامل", `#${o1?.display_id} بقيمة ${o1?.total}`)
    // إيقاف مؤقت ← صفحة صيانة ← استئناف
    await waitJob((await api("POST", `/api/stores/${slug}/pause`)).body.jobId, "إيقاف مؤقت")
    const m = await fetch(`${e.STOREFRONT_URL}/om`).catch(() => null)
    ok(m?.status === 503 && m.headers.get("x-naqla-maintenance") === "1", "صفحة الصيانة (503) أثناء الإيقاف")
    await waitJob((await api("POST", `/api/stores/${slug}/resume`)).body.jobId, "استئناف حتى /ready", 10)
    ok((await fetch(`${e.MEDUSA_BACKEND_URL}/ready`)).ok, "المتجر يعمل بعد الاستئناف")
    // نسخة ← طلب جديد ← استعادة (الطلب الجديد يختفي)
    await waitJob((await api("POST", `/api/stores/${slug}/backup`)).body.jobId, "نسخة احتياطية الآن")
    const before = await orderCount(slug)
    await purchase(slug)
    ok((await orderCount(slug)) === before + 1, "طلب بعد النسخة", `${before} ← ${before + 1}`)
    const [bk] = await q(`select id from backups where store_slug=$1 and kind='manual' order by id desc limit 1`, [slug])
    ok((await api("POST", `/api/stores/${slug}/restore`, { backupId: Number(bk.id), confirm: "wrong" })).status === 400, "الاستعادة بلا تأكيد مكتوب مرفوضة")
    await waitJob((await api("POST", `/api/stores/${slug}/restore`, { backupId: Number(bk.id), confirm: slug })).body.jobId, "الاستعادة حتى /ready", 12)
    ok((await orderCount(slug)) === before, "الاستعادة أعادت الحالة (الطلب اللاحق اختفى)", `${await orderCount(slug)} طلب`)
    // الحذف بأرشفة ونسخة أخيرة
    ok((await api("POST", `/api/stores/${slug}/delete`, { confirm: "no" })).status === 400, "الحذف بلا تأكيد مكتوب مرفوض")
    await waitJob((await api("POST", `/api/stores/${slug}/delete`, { confirm: slug })).body.jobId, "حذف المتجر")
    const [after] = await q(`select status from stores where slug=$1`, [slug])
    const dbs = (await q(`select 1 from pg_database where datname=$1`, [`naqla_${slug.replace(/-/g, "_")}`])).length
    const archived = readdirSync(`${ROOT}.archive`).some((d) => d.startsWith(`${slug}-`))
    // النسخة الأخيرة لهذا التشغيل فقط (الرمز يُعاد استخدامه بين التشغيلات)
    const [fin] = await q(`select count(*) n from backups where store_slug=$1 and kind='final' and created_at > (select created_at from stores where slug=$1)`, [slug])
    ok(after.status === "deleted" && dbs === 0 && !existsSync(`${ROOT}clients/${slug}`) && archived && Number(fin.n) === 1, "حُذف: القاعدة والمجلد أُزيلا، والأرشيف والنسخة الأخيرة موجودان")
    // لا عمليات يتيمة للمتجر بعد الحذف (medusa develop كان يترك خادمه حياً على المنفذ)
    const orphans = readdirSync("/proc").filter((d) => /^\d+$/.test(d)).filter((d) => { try { return readFileSync(`/proc/${d}/environ`, "latin1").split("\0").includes(`STORE=${slug}`) } catch { return false } })
    ok(orphans.length === 0, "لا عمليات يتيمة للمتجر بعد الحذف", orphans.length ? `بقيت ${orphans.length}` : "")
    const audit = await q(`select action from audit where target=$1`, [slug])
    ok(["store.create", "store.pause", "store.resume", "store.backup", "store.restore", "store.delete"].every((x) => audit.some((a) => a.action === x)), "كل عملية في سجل العمليات")
  }
}

async function cleanup() {
  for (const slug of ["t-fashion", "t-perfume"]) {
    const [r] = await q(`select status from stores where slug=$1`, [slug])
    if (r && r.status !== "deleted") { const d = await api("POST", `/api/stores/${slug}/delete`, { confirm: slug }); if (d.body.jobId) await waitJob(d.body.jobId, `تنظيف ${slug}`) }
  }
}
const sections = { cleanup, auth, fashion: crucialFor("t-fashion", "fashion", "بوتيك الاختبار", "ward-jabal"), perfume: crucialFor("t-perfume", "perfume", "عطور الاختبار", "lail-dhahab") }
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(sections)
for (const s of want) await sections[s]()
await db.end()
console.log(`\n${failn ? "✖" : "✔"} ${pass} نجح، ${failn} فشل`)
process.exit(failn ? 1 : 0)
