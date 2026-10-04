// pnpm store:new <slug> — ينسخ قالب العميل إلى clients/<slug> ويطبع الخطوات التالية
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CLIENTS, c, fail, slugArg } from "./lib.mjs"

const slug = slugArg()
const dest = join(CLIENTS, slug)
if (existsSync(dest)) fail(`clients/${slug} موجود مسبقاً`)

cpSync(join(CLIENTS, "_template"), dest, { recursive: true })
const file = join(dest, "store.json")
writeFileSync(file, readFileSync(file, "utf8").replaceAll("__SLUG__", slug))

console.log(c.g(`✔ أُنشئ clients/${slug}/`))
console.log(`
${c.b("الخطوات التالية:")}
  1. ${c.b(`clients/${slug}/store.json`)} — الاسم والتواصل والقائمة والمنتجات والأقسام والتوصيل والمزايا (features)
     • الخطوط من القائمة الجاهزة: apps/storefront/src/fonts/presets.json
     • خيارات المنتج (options): type = "buttons" أو "color" (دوائر ألوان مع swatches)
  2. ${c.b(`clients/${slug}/theme.css`)} — الألوان فقط (نهاري وليلي)
  3. الصور: ${c.b("logo.svg")}، ${c.b("icons/icon-192.png")} و${c.b("icon-512.png")}، ${c.b("og.jpg")} (1600×900)، وصور المنتجات في ${c.b("images/")}
  4. ${c.b(`pnpm store:setup ${slug}`)} — قاعدة بيانات جديدة + البذرة + الصور + مستخدم أدمن
  5. ${c.b(`pnpm store:dev ${slug}`)} — تشغيل الخلفية والواجهة على منفذين خاصين بالمتجر
`)
