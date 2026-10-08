/**
 * pnpm console:setup <email> [--password <pw>] [--reset-totp]
 * ينشئ قاعدة naqla_console وجداولها، ومدير اللوحة (كلمة مرور + سر TOTP) ويطبع رمز QR لتطبيق المصادقة.
 */
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "pg"
import QR from "qrcode"
import { hashPassword } from "../src/lib/auth-hash"
import { SCHEMA } from "../src/lib/db-schema"
import { newSecret, otpauthUri } from "../src/lib/totp"

const ROOT = join(__dirname, "..", "..", "..")
const envOf = (f: string) => Object.fromEntries((existsSync(f) ? readFileSync(f, "utf8") : "").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined }

async function main() {
  const email = process.argv[2]
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("الاستخدام: pnpm console:setup you@example.com [--password …]")
  const envFile = join(__dirname, "..", ".env.local")
  const local = envOf(envFile)
  // في حاوية الإنتاج: من البيئة (deploy/docker-compose.yml)؛ في التطوير: .env.local أو قاعدة الخلفية
  const base = process.env.CONSOLE_DATABASE_URL || local.CONSOLE_DATABASE_URL || envOf(join(ROOT, "apps", "backend", ".env")).DATABASE_URL
  if (!base) throw new Error("DATABASE_URL غير موجود في apps/backend/.env")
  const url = new URL(base); url.pathname = "/naqla_console"
  const admin = new URL(base); admin.pathname = "/postgres"
  const c0 = new Client({ connectionString: admin.toString() }); await c0.connect()
  const exists = (await c0.query(`select 1 from pg_database where datname='naqla_console'`)).rowCount
  if (!exists) await c0.query(`create database naqla_console`)
  await c0.end()
  const c = new Client({ connectionString: url.toString() }); await c.connect()
  await c.query(SCHEMA)
  const password = arg("--password") || randomBytes(12).toString("base64url")
  const row = (await c.query(`select id, totp_secret from admins where lower(email)=lower($1)`, [email])).rows[0]
  const secret = row && !process.argv.includes("--reset-totp") ? row.totp_secret : newSecret()
  if (row) await c.query(`update admins set password_hash=$1, totp_secret=$2, totp_last_step=0 where id=$3`, [hashPassword(password), secret, row.id])
  else await c.query(`insert into admins (email, password_hash, totp_secret) values ($1,$2,$3)`, [email, hashPassword(password), secret])
  await c.end()
  if (!local.CONSOLE_DATABASE_URL && !process.env.CONSOLE_DATABASE_URL) writeFileSync(envFile, `CONSOLE_DATABASE_URL=${url.toString()}\n` + (existsSync(envFile) ? readFileSync(envFile, "utf8") : ""))
  const uri = otpauthUri(secret, email)
  console.log(`\n✔ مدير لوحة نقلة: ${email}\n  كلمة المرور: ${arg("--password") ? "(كما أدخلتها)" : password}\n  امسح الرمز بـ Google Authenticator:\n`)
  console.log(await QR.toString(uri, { type: "terminal", small: true }))
  console.log(`  أو أدخل السر يدوياً: ${secret}\n  التشغيل: pnpm console:dev (التطوير) أو https://console.<PLATFORM_DOMAIN> (الإنتاج)\n`)
  if (process.argv.includes("--print-secret")) console.log(`TOTP_SECRET=${secret}`)
}
main().catch((e) => { console.error("✖", e.message); process.exit(1) })
