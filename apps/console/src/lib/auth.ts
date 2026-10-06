import { createHash, randomBytes } from "node:crypto"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { q } from "./db"
import { verify } from "./totp"

/** دخول المدير: كلمة مرور (scrypt) + TOTP، جلسة قصيرة (خمول 30 دقيقة، حد 8 ساعات)، قفل بعد 5 محاولات/15 دقيقة */
export const COOKIE = "naqla_console_sid"
const IDLE_MIN = 30, MAX_HOURS = 8, MAX_FAILS = 5

import { checkPassword } from "./auth-hash"
export { hashPassword } from "./auth-hash"
const sha = (s: string) => createHash("sha256").update(s).digest("hex")

/** عنوان العميل: X-Forwarded-For (آخر قيمة) فقط عندما تعمل اللوحة خلف وكيل موثوق (TRUST_PROXY=1)؛ وإلا يُتجاهل */
export async function clientIp() {
  const h = await headers()
  if (process.env.TRUST_PROXY === "1") {
    return (h.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean).pop() || h.get("x-real-ip") || "direct"
  }
  return "direct"
}

export async function audit(action: string, opts: { email?: string | null; target?: string | null; ok?: boolean; detail?: unknown } = {}) {
  await q(`insert into audit (admin_email, action, target, ok, detail, ip) values ($1,$2,$3,$4,$5,$6)`,
    [opts.email ?? null, action, opts.target ?? null, opts.ok ?? true, JSON.stringify(opts.detail ?? {}), await clientIp()])
}

export async function login(email: string, password: string, code: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const ip = await clientIp()
  // القفل لكل عنوان ولكل حساب معاً (تغيير العنوان لا يعطي محاولات جديدة)
  const [{ n }] = await q<{ n: string }>(`select count(*) n from audit where action='login' and ok=false and at > now() - interval '15 minutes' and (ip=$1 or lower(admin_email)=lower($2))`, [ip, String(email).trim()])
  if (Number(n) >= MAX_FAILS) return { ok: false, error: "محاولات كثيرة — حاول بعد 15 دقيقة" }
  const [a] = await q(`select * from admins where lower(email)=lower($1)`, [String(email).trim()])
  const fail = async (why: string) => { await audit("login", { email, ok: false, detail: { why } }); return { ok: false as const, error: "بيانات الدخول أو الرمز غير صحيحة" } }
  if (!a || !checkPassword(String(password), a.password_hash)) return fail("password")
  const step = verify(a.totp_secret, String(code).trim())
  if (step === null) return fail("totp")
  // ذري: طلبان متزامنان بنفس الرمز ← واحد فقط يحجز الخطوة (كان كلاهما يفتح جلسة)
  const claimed = await q(`update admins set totp_last_step=$1 where id=$2 and totp_last_step < $1 returning id`, [step, a.id])
  if (!claimed.length) return fail("totp_replay")
  const token = randomBytes(32).toString("base64url")
  await q(`insert into sessions (token_hash, admin_id, ip) values ($1,$2,$3)`, [sha(token), a.id, ip])
  await audit("login", { email: a.email })
  return { ok: true, token }
}

export const cookieOptions = () => ({ httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_HOURS * 3600 })

/** المدير الحالي أو null (يجدّد الخمول) */
export async function currentAdmin(): Promise<{ id: number; email: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const [s] = await q(`select s.token_hash, a.id, a.email from sessions s join admins a on a.id=s.admin_id
    where s.token_hash=$1 and s.last_seen > now() - interval '${IDLE_MIN} minutes' and s.created_at > now() - interval '${MAX_HOURS} hours'`, [sha(token)])
  if (!s) return null
  await q(`update sessions set last_seen=now() where token_hash=$1`, [s.token_hash])
  return { id: s.id, email: s.email }
}
export async function requireAdmin() {
  const a = await currentAdmin()
  if (!a) redirect("/login")
  return a
}
export async function logout() {
  const token = (await cookies()).get(COOKIE)?.value
  if (token) await q(`delete from sessions where token_hash=$1`, [sha(token)])
}
