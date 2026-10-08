// pnpm store:import <slug> <file.xlsx> [--images] [--sheet <اسم الورقة>]
// يحوّل جدول منتجات (تصدير متجر سابق) إلى clients/<slug>/catalog.json حسب قواعد clients/<slug>/import.json:
// الأعمدة، تنظيف العناوين (titleStrip)، الأقسام (قواعد نصية بالترتيب)، توحيد البراندات (تصبح مجموعات)، المخزون، وتنسيق الوصف.
// --images ينزّل الصور إلى clients/<slug>/images/products/ (يتخطى الموجود) فلا يبقى المتجر معتمداً على مستضيف المتجر السابق؛
// الكتالوج يشير إلى المسارات المحلية دائماً، فالتنزيل قبل store:setup (البذرة ترفع الموجود منها إلى الخادم).
// الكتالوج يقرؤه الخادم فقط (البذرة) — لا يدخل حزمة الواجهة كما يدخلها store.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { extname, join } from "node:path"
import { CLIENTS, c, fail, slugArg } from "./lib.mjs"
import { readXlsx } from "./xlsx.mjs"

const slug = slugArg()
const file = process.argv[3]
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined }
if (!file || !existsSync(file)) fail(`حدّدي ملف المنتجات: pnpm store:import ${slug} <file.xlsx>`)
const dir = join(CLIENTS, slug)
const rulesFile = join(dir, "import.json")
if (!existsSync(join(dir, "store.json"))) fail(`لا يوجد clients/${slug}/store.json — ابدئي بـ pnpm store:new ${slug}`)
if (!existsSync(rulesFile)) fail(`لا يوجد clients/${slug}/import.json (قواعد الاستيراد: الأعمدة والأقسام والبراندات)`)
const R = JSON.parse(readFileSync(rulesFile, "utf8"))
const store = JSON.parse(readFileSync(join(dir, "store.json"), "utf8"))

// ---------- الجدول ----------
const sheets = readXlsx(file)
const sheet = arg("--sheet") ? sheets.find((s) => s.name === arg("--sheet")) : sheets[0]
if (!sheet) fail(`الورقة غير موجودة (المتاح: ${sheets.map((s) => s.name).join("، ")})`)
const [head, ...body] = sheet.rows
const col = Object.fromEntries(Object.entries(R.columns).map(([k, name]) => {
  const i = head.findIndex((h) => String(h ?? "").trim() === name)
  if (i < 0 && ["title", "price"].includes(k)) fail(`العمود «${name}» (${k}) غير موجود في الورقة`)
  return [k, i]
}))
const cell = (row, k) => { const v = col[k] >= 0 ? row[col[k]] : null; return typeof v === "string" ? v.trim() || null : v }
const rows = body.filter((r) => cell(r, "title"))

// ---------- الأقسام ----------
const rx = (list) => (list ?? []).map((s) => new RegExp(s, "i"))
const rules = R.categories.map((r) => ({ ...r, title: rx(r.title), category: rx(r.category), fallback: rx(r.titleFallback) }))
const known = new Set((store.categories ?? []).map((x) => x.handle))
for (const r of rules) if (!known.has(r.handle)) fail(`القسم «${r.handle}» في import.json غير معرّف في store.json → categories`)
if (R.fallbackCategory && !known.has(R.fallbackCategory)) fail(`fallbackCategory «${R.fallbackCategory}» غير معرّف في store.json → categories`)
/** العنوان القوي أولاً (واقي شمس، عدسات…)، ثم تصنيف المصدر، ثم كلمات العنوان، ثم الافتراضي */
function categoryOf(title, raw) {
  return rules.find((r) => r.title.some((x) => x.test(title)))?.handle
    ?? (raw ? rules.find((r) => r.category.some((x) => x.test(raw)))?.handle : undefined)
    ?? rules.find((r) => r.fallback.some((x) => x.test(title)))?.handle
    ?? R.fallbackCategory
}

// ---------- البراندات ← مجموعات ----------
const bkey = (b) => String(b ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]/g, "")
const alias = Object.fromEntries(Object.entries(R.brands?.aliases ?? {}).map(([k, v]) => [bkey(k), bkey(v)]))
const brandKey = (b) => { const k = bkey(b); return alias[k] ?? k }
const latinHandle = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const spellings = new Map()
for (const r of rows) {
  const b = cell(r, "brand")
  if (!b) continue
  const k = brandKey(b)
  if (!spellings.has(k)) spellings.set(k, new Map())
  spellings.get(k).set(String(b), (spellings.get(k).get(String(b)) ?? 0) + 1)
}
const titleOverride = Object.fromEntries(Object.entries(R.brands?.titles ?? {}).map(([k, v]) => [brandKey(k), v]))
const handleOverride = Object.fromEntries(Object.entries(R.brands?.handles ?? {}).map(([k, v]) => [brandKey(k), v]))
const brands = new Map()
for (const [k, m] of spellings) {
  // الاسم الأكثر تكراراً في المصدر (SHEGLAM لا Sheglam إن كان الأغلب)
  const title = titleOverride[k] ?? [...m].sort((a, b) => b[1] - a[1])[0][0]
  const handle = handleOverride[k] ?? latinHandle(title)
  if (!handle) fail(`البراند «${title}» بلا رابط لاتيني — أضيفيه في import.json → brands.handles`)
  brands.set(k, { handle, title, count: [...m.values()].reduce((a, b) => a + b, 0) })
}
const dupHandles = [...brands.values()].map((b) => b.handle).filter((h, i, a) => a.indexOf(h) !== i)
if (dupHandles.length) fail(`روابط براندات مكررة: ${[...new Set(dupHandles)].join("، ")} — وحّديها في brands.aliases`)

// ---------- الوصف ----------
const sections = R.descriptionSections ?? []
/** «● العنوان نص…» تصبح فقرات بعنوان في سطر مستقل (الواجهة تحفظ الأسطر) */
function formatDescription(d) {
  if (!d) return ""
  const [intro, ...parts] = String(d).split(/\s*●\s*/)
  return [intro.trim(), ...parts.map((p) => {
    const h = sections.find((s) => p.startsWith(s + " ") || p === s)
    return h ? `${h}\n${p.slice(h.length).trim()}` : p.trim()
  })].filter(Boolean).join("\n\n")
}

// ---------- الخيار ----------
// Medusa 2.21 يشترط خياراً لكل منتج: خيار واحد (العبوة) قيمته الحجم من آخر «رقم + وحدة» في العنوان، وإلا fallback
const O = R.option
const unitOf = new Map(Object.entries(O?.units ?? {}).flatMap(([canon, list]) => list.map((u) => [u.toLowerCase(), canon])))
const unitRx = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${[...unitOf.keys()].sort((a, b) => b.length - a.length).map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`, "giu")
function packOf(title) {
  const m = [...title.matchAll(unitRx)].pop()
  if (!m) return O.fallback
  const n = m[1].replace(",", ".")
  const unit = unitOf.get(m[2].toLowerCase())
  if (Number(n) === 1 && O.plural?.[unit]) return O.fallback
  // العدد 3–10 يأخذ جمع الوحدة (4 قطع، 5 أكياس)، وما سواه المفرد
  return `${n} ${Number(n) >= 3 && Number(n) <= 10 ? O.plural?.[unit] ?? unit : unit}`
}

// ---------- الصور: الامتداد من محتوى الملف (خادم الملفات يرفض صورة لا يطابق محتواها امتدادها) ----------
const EXTS = [".jpg", ".png", ".webp", ".avif", ".gif"]
const localImage = (base) => EXTS.map((e) => base + e).find((f) => existsSync(join(dir, f)))
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg"
  if (buf.subarray(0, 4).toString("hex") === "89504e47") return ".png"
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return ".webp"
  if (buf.toString("ascii", 4, 8) === "ftyp" && /^avi[fs]/.test(buf.toString("ascii", 8, 12))) return ".avif"
  if (buf.toString("ascii", 0, 3) === "GIF") return ".gif"
  return null
}

// ---------- المنتجات ----------
const strip = rx(R.titleStrip)
const yes = new Set(R.yes ?? ["نعم", "yes", "true", "1"])
const handleFix = R.handles ?? {}
const skus = new Map()
for (const r of rows) { const s = cell(r, "sku"); if (s != null) skus.set(String(s), (skus.get(String(s)) ?? 0) + 1) }
const imagesDir = join(dir, "images", "products")
const report = { categories: {}, brandless: 0, skuFallback: 0, outOfStock: 0, rawUnmatched: new Map(), fallbackCategory: [] }
const seen = new Set()
const products = []
const downloads = []
for (const [i, r] of rows.entries()) {
  const title = strip.reduce((t, x) => t.replace(x, ""), String(cell(r, "title"))).trim()
  const url = cell(r, "url")
  let handle = url ? decodeURIComponent(String(url).split("/products/")[1] ?? "").split(/[?#/]/)[0] : ""
  handle = handleFix[handle] ?? handle
  if (!/^[a-z0-9][a-z0-9-]*$/.test(handle)) handle = latinHandle(handle) || `p-${i + 2}`
  while (seen.has(handle)) handle = `${handle}-${i + 2}`
  seen.add(handle)

  const raw = cell(r, "category")
  const category = categoryOf(title, raw)
  report.categories[category] = (report.categories[category] ?? 0) + 1
  if (raw && !rules.some((x) => x.category.some((y) => y.test(raw))) && !rules.some((x) => x.title.some((y) => y.test(title)))) report.rawUnmatched.set(raw, (report.rawUnmatched.get(raw) ?? 0) + 1)
  if (category === R.fallbackCategory && !rules.find((x) => x.handle === category)?.category.some((y) => y.test(raw ?? ""))) report.fallbackCategory.push(title)

  const b = cell(r, "brand")
  const brand = b ? brands.get(brandKey(b)) : null
  if (!brand) report.brandless++

  const sku = cell(r, "sku") != null ? String(cell(r, "sku")) : null
  const uniqueSku = sku && skus.get(sku) === 1 ? sku : null
  if (sku && !uniqueSku) report.skuFallback++

  const available = yes.has(String(cell(r, "available") ?? "نعم").trim())
  if (!available) report.outOfStock++

  const remote = [...new Set([cell(r, "image"), ...String(cell(r, "images") ?? "").split("|")].map((u) => String(u ?? "").trim()).filter((u) => /^https?:\/\//.test(u)))]
  const images = remote.map((u, n) => {
    const base = `images/products/${handle}-${n + 1}`
    const ext = (extname(new URL(u).pathname).toLowerCase().match(/^\.(jpe?g|png|webp|avif)$/) ?? [".jpg"])[0]
    const im = { base, rel: localImage(base) ?? base + ext }
    if (!localImage(base)) downloads.push({ url: u, im })
    return im
  })

  const price = Number(cell(r, "price"))
  const compare = Number(cell(r, "compareAt"))
  products.push({
    handle,
    title,
    category,
    collection: brand?.handle ?? null,
    description: formatDescription(cell(r, "description")),
    price,
    ...(compare > price ? { compare_at: compare } : {}),
    images,
    options: O ? { [O.key]: [packOf(title)] } : {},
    stock: { default: available ? R.defaultStock ?? 10 : 0 },
    // الرمز المولَّد في البذرة يأخذ أول 10 أحرف من الرابط فيتكرر في كتالوج كبير — الرابط كاملاً بديل فريد
    sku: uniqueSku ?? handle.toUpperCase(),
    tags: [],
  })
}

// ---------- الصور ----------
if (process.argv.includes("--images") && downloads.length) {
  mkdirSync(imagesDir, { recursive: true })
  console.log(c.d(`تنزيل ${downloads.length} صورة…`))
  let done = 0, failed = 0
  const queue = [...downloads]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let d; (d = queue.shift());) {
      try {
        const res = await fetch(d.url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) throw new Error(String(res.status))
        const buf = Buffer.from(await res.arrayBuffer())
        const ext = sniff(buf)
        if (!ext) throw new Error("ليست صورة")
        d.im.rel = d.im.base + ext
        writeFileSync(join(dir, d.im.rel), buf)
        if (++done % 100 === 0) console.log(c.d(`  ${done}/${downloads.length}`))
      } catch (e) {
        if (++failed <= 5) console.log(c.y(`  تعذّر ${d.url}: ${e.cause?.code ?? e.message}`))
      }
    }
  }))
  console.log(failed ? c.y(`نُزّلت ${done} وتعذّرت ${failed} (أعيدي الأمر لإكمال الناقص)`) : c.g(`✔ نُزّلت ${done} صورة`))
}
// المسار المحلي دائماً: رابط المستضيف السابق يُسقط صفحات الواجهة (محسّن الصور يقبل الخلفية فقط)،
// والبذرة (seed-04) ترفع الموجود وتحذّر من الناقص — نزّلي الصور قبل store:setup
let remoteLeft = 0
for (const p of products) p.images = p.images.map((im) => (existsSync(join(dir, im.rel)) || remoteLeft++, im.rel))

const collections = [...brands.values()].sort((a, b) => b.count - a.count).map(({ handle, title }) => ({ handle, title }))
writeFileSync(join(dir, "catalog.json"), JSON.stringify({
  $schema: `كتالوج مستورد بـ pnpm store:import من ${file.split("/").pop()} — يُدمج فوق store.json في البذرة (collections وproducts)، ولا يدخل حزمة الواجهة`,
  collections,
  products,
}, null, 1) + "\n")

console.log(c.g(`\n✔ clients/${slug}/catalog.json — ${products.length} منتجاً، ${collections.length} براند (مجموعة)`))
const name = Object.fromEntries((store.categories ?? []).map((x) => [x.handle, x.name]))
for (const [h, n] of Object.entries(report.categories).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${name[h]} (${h})`)
console.log(c.d(`  غير متوفر (مخزون 0): ${report.outOfStock} · بلا براند: ${report.brandless} · رمز SKU مكرر استُبدل برابط المنتج: ${report.skuFallback}`))
if (report.rawUnmatched.size) console.log(c.y(`  تصنيفات مصدر بلا قاعدة (${report.rawUnmatched.size}): ${[...report.rawUnmatched].map(([k, v]) => `${k}×${v}`).join("، ")}`))
if (report.fallbackCategory.length) console.log(c.y(`  إلى القسم الافتراضي بلا قاعدة (${report.fallbackCategory.length}): ${report.fallbackCategory.slice(0, 15).join(" | ")}`))
if (remoteLeft) console.log(c.y(`  ${remoteLeft} صورة لم تُنزَّل بعد — قبل store:setup: pnpm store:import ${slug} ${file} --images`))
