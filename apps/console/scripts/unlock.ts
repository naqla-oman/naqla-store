/**
 * pnpm console:unlock <email> — يفك قفل الدخول للمدير: يمسح محاولات الدخول الفاشلة الأخيرة (لكل الحساب ولكل العناوين).
 * القفل: 5 محاولات فاشلة خلال 15 دقيقة على البريد أو العنوان ← رفض 15 دقيقة. بلا TRUST_PROXY كل الطلبات عنوان واحد («direct»).
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "pg"

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error("الاستخدام: pnpm console:unlock you@example.com")
  const envFile = join(__dirname, "..", ".env.local")
  const env = Object.fromEntries((existsSync(envFile) ? readFileSync(envFile, "utf8") : "").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
  const c = new Client({ connectionString: env.CONSOLE_DATABASE_URL }); await c.connect()
  const r = await c.query(`delete from audit where action='login' and ok=false and at > now() - interval '15 minutes' and (lower(admin_email)=lower($1) or ip in (select ip from audit where action='login' and ok=false and lower(admin_email)=lower($1) and at > now() - interval '15 minutes'))`, [email])
  await c.query(`insert into audit (admin_email, action, target, ok, detail, ip) values ($1, 'unlock', $1, true, '{"by":"cli"}', 'cli')`, [email])
  await c.end()
  console.log(`✔ أُزيلت ${r.rowCount} محاولة فاشلة — يمكن الدخول الآن لـ ${email}`)
}
main().catch((e) => { console.error("✖", e.message); process.exit(1) })
