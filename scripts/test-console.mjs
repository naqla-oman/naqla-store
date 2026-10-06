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

const sections = { auth }
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(sections)
for (const s of want) await sections[s]()
await db.end()
console.log(`\n${failn ? "✖" : "✔"} ${pass} نجح، ${failn} فشل`)
process.exit(failn ? 1 : 0)
