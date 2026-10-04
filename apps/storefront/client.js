/**
 * العميل الحالي للواجهة: clients/<STORE>/ — يُستخدم في next.config (الأسماء المستعارة) ومسار الملفات.
 * لا توجد قيمة افتراضية: بلا STORE يتوقف التشغيل برسالة واضحة.
 */
const fs = require("fs")
const path = require("path")

const presets = require("./src/fonts/presets.json")

function clientSlug() {
  const slug = (process.env.STORE || "").trim()
  if (!slug) {
    throw new Error("STORE غير محدد — أضيفي STORE=<slug> إلى apps/storefront/.env.local (المجلد clients/<slug>/)")
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`STORE غير صالح: «${slug}»`)
  return slug
}

function clientDir() {
  // من مجلد التشغيل (apps/storefront) لا __dirname: عند حزم المسارات يصبح __dirname مساراً افتراضياً
  const base = process.env.CLIENTS_DIR ? path.resolve(process.env.CLIENTS_DIR) : path.resolve(process.cwd(), "../../clients")
  const dir = path.join(base, clientSlug())
  if (!fs.existsSync(path.join(dir, "store.json"))) {
    throw new Error(`لا يوجد ${path.join(dir, "store.json")} — أنشئي العميل بـ pnpm store:new ${clientSlug()}`)
  }
  return dir
}

function clientStore() {
  const store = JSON.parse(fs.readFileSync(path.join(clientDir(), "store.json"), "utf8"))
  store.fonts = { latin: "none", ...(store.fonts || {}) }
  for (const kind of ["display", "body", "latin"]) {
    const id = store.fonts && store.fonts[kind]
    if (!presets[kind].includes(id)) {
      throw new Error(`store.json → fonts.${kind} = «${id}» غير موجود. المتاح: ${presets[kind].join("، ")}`)
    }
  }
  return store
}

module.exports = { clientSlug, clientDir, clientStore }
