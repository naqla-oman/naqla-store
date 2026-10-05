#!/usr/bin/env node
// pnpm store:deploy <slug> --domain <domain>
// يولّد ملفات إنتاج المتجر (خارج Git): .stores/<slug>.prod.env + deploy/stores/<slug>.compose.yml + deploy/sites/<slug>.caddy
// ثم على الخادم: deploy/up.sh <slug>
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CLIENTS, ROOT, STORES, c, fail, readEnv, slugArg } from "./lib.mjs"

const slug = slugArg()
const di = process.argv.indexOf("--domain")
const domain = (di > 0 ? process.argv[di + 1] : "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) fail("حدّدي النطاق: pnpm store:deploy <slug> --domain example.om")
if (!existsSync(join(CLIENTS, slug, "store.json"))) fail(`لا يوجد clients/${slug}/store.json`)

const DEPLOY = join(ROOT, "deploy")
const envFile = join(STORES, `${slug}.prod.env`)
const prev = readEnv(envFile)
const strong = (v, n = 32) => typeof v === "string" && v.length >= n
const secret = (k, bytes) => (strong(prev[k]) ? prev[k] : randomBytes(bytes).toString("base64url"))
const deployEnv = readEnv(join(DEPLOY, ".env"))
if (!deployEnv.POSTGRES_PASSWORD) console.log(c.y("تنبيه: POSTGRES_PASSWORD غير موجود في deploy/.env بعد — ضعيه قبل up.sh"))
const db = `naqla_${slug.replace(/-/g, "_")}`
const site = `https://${domain}`
const api = `https://api.${domain}`

// مفاتيح يديرها هذا السكربت؛ أي مفتاح آخر في الملف السابق (ثواني، واتساب، البريد…) يبقى كما هو
const env = {
  STORE: slug,
  NODE_ENV: "production",
  // أسرار إنتاج مستقلة عن التطوير (لا تُنسخ من .stores/<slug>.env)
  JWT_SECRET: secret("JWT_SECRET", 48),
  COOKIE_SECRET: secret("COOKIE_SECRET", 48),
  REVALIDATE_SECRET: secret("REVALIDATE_SECRET", 32),
  PHONE_AUTH_SECRET: secret("PHONE_AUTH_SECRET", 32),
  DATABASE_URL: `postgres://naqla:${deployEnv.POSTGRES_PASSWORD || "<POSTGRES_PASSWORD>"}@postgres:5432/${db}`,
  REDIS_URL: "redis://redis:6379",
  MEDUSA_BACKEND_URL: api,
  STOREFRONT_URL: site,
  NEXT_PUBLIC_BASE_URL: site,
  STORE_CORS: `${site},https://www.${domain}`,
  ADMIN_CORS: api,
  AUTH_CORS: `${site},https://www.${domain},${api}`,
  UPLOADS_DIR: "/data/uploads",
  PRIVATE_FILES_DIR: "/data/private",
  STORE_DOMAIN: domain,
  STORE_DB: db,
  // يملؤه up.sh من قاعدة الإنتاج بعد الإقلاع الأول (البذرة تنشئه)
  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: prev.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
}
const keep = Object.entries(prev).filter(([k]) => !(k in env))
mkdirSync(STORES, { recursive: true })
writeFileSync(envFile, [`# إنتاج «${slug}» — أنشأه store:deploy (لا يُرفع إلى Git، صلاحيات 600)`, ...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...keep.map(([k, v]) => `${k}=${v}`), ""].join("\n"), { mode: 0o600 })

const svc = slug.replace(/[^a-z0-9-]/g, "-")
mkdirSync(join(DEPLOY, "stores"), { recursive: true })
writeFileSync(join(DEPLOY, "stores", `${slug}.compose.yml`), `# مولَّد بـ store:deploy — لا يُرفع إلى Git
services:
  backend-${svc}:
    build: { context: ../.., dockerfile: deploy/backend.Dockerfile, args: { STORE: "${slug}" } }
    restart: unless-stopped
    env_file: ../../.stores/${slug}.prod.env
    volumes: [uploads_${svc}:/data/uploads, private_${svc}:/data/private]
    mem_limit: 900m
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:9000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 120s

  storefront-${svc}:
    build:
      context: ../..
      dockerfile: deploy/storefront.Dockerfile
      args:
        STORE: "${slug}"
        NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: \${PK_${svc.replace(/-/g, "_").toUpperCase()}:-}
        NEXT_PUBLIC_BASE_URL: ${site}
        MEDUSA_BACKEND_URL: http://backend-${svc}:9000
    restart: unless-stopped
    env_file: ../../.stores/${slug}.prod.env
    environment:
      MEDUSA_BACKEND_URL: http://backend-${svc}:9000
    mem_limit: 400m
    depends_on:
      backend-${svc}: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s

volumes:
  uploads_${svc}: {}
  private_${svc}: {}
`)

mkdirSync(join(DEPLOY, "sites"), { recursive: true })
writeFileSync(join(DEPLOY, "sites", `${slug}.caddy`), `# مولَّد بـ store:deploy — لا يُرفع إلى Git
${domain}, www.${domain} {
	import security
	import access_log
	header X-Frame-Options "SAMEORIGIN"
	header Content-Security-Policy "frame-ancestors 'self'"
	reverse_proxy storefront-${svc}:8000
}

api.${domain} {
	import security
	import access_log
	header X-Frame-Options "DENY"
	header Content-Security-Policy "frame-ancestors 'none'"
	reverse_proxy backend-${svc}:9000
}
`)

console.log(c.g(`✔ ملفات إنتاج «${slug}» على ${domain}:`))
console.log(`  .stores/${slug}.prod.env  (أسرار جديدة${keep.length ? ` + ${keep.length} مفتاح محفوظ` : ""})`)
console.log(`  deploy/stores/${slug}.compose.yml`)
console.log(`  deploy/sites/${slug}.caddy`)
console.log(c.b("\nالتالي على الخادم:") + ` deploy/up.sh ${slug}`)
console.log(`DNS: ${domain} و www.${domain} و api.${domain} ← عنوان الخادم (A)`)
