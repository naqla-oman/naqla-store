// pnpm test:i18n [slug] — الاختبار الحاسم لتعدد اللغات (العربية الأصل، الإنجليزية /en). يفعّل الإنجليزية من إعدادات اللوحة ثم يعيدها.
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
const slug = process.argv[2] || process.env.STORE || (() => { throw new Error("الاستخدام: pnpm test:i18n <slug>") })()
const env = Object.fromEntries(readFileSync(new URL(`../.stores/${slug}.env`, import.meta.url), "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
const S = env.STOREFRONT_URL, B = env.MEDUSA_BACKEND_URL
let pass = 0, failn = 0
const ok = (c, label, extra = "") => { c ? pass++ : failn++; console.log(`${c ? "✔" : "✖"} ${label}${extra ? ` — ${extra}` : ""}`) }
const jar = `/tmp/jar-i18n-${slug}`
const curl = (path, extra = []) => { const out = execFileSync("curl", ["-s", "-L", "-c", jar, "-b", jar, "-m", "240", "-o", "/tmp/i18n-body", "-w", "%{http_code} %{url_effective}", ...extra, `${S}${path}`]).toString(); const [code, url] = out.split(" "); return { code: Number(code), url, html: readFileSync("/tmp/i18n-body", "utf8") } }
const attrs = (h) => ({ lang: (h.match(/<html[^>]*\blang="([^"]+)"/) ?? [])[1], dir: (h.match(/<html[^>]*\bdir="([^"]+)"/) ?? [])[1], switch: h.includes('data-testid="lang-switch"') })
const tok = () => JSON.parse(execFileSync("curl", ["-s", "-m", "20", "-X", "POST", `${B}/auth/user/emailpass`, "-H", "Content-Type: application/json", "-d", JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })]).toString()).token
const settings = (values, t) => JSON.parse(execFileSync("curl", ["-s", "-m", "30", "-X", "POST", `${B}/admin/naqla/store-settings`, "-H", "Content-Type: application/json", "-H", `Authorization: Bearer ${t}`, "-d", JSON.stringify({ values })]).toString())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function stage0() {
  const t = tok()
  console.log("\n— متجر بلغة واحدة —")
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
  curl("/om") // كوكي المنطقة
  let ar = curl("/om")
  for (let i = 0; i < 14 && attrs(ar.html).switch; i++) { await sleep(5000); ar = curl("/om") } // إبطال الذاكرة بعد الحفظ
  const a = attrs(ar.html)
  ok(ar.code === 200 && a.lang === "ar" && a.dir === "rtl", "/om عربي rtl", `${a.lang}/${a.dir}`)
  ok(!a.switch, "لا مبدّل لغة في متجر بلغة واحدة")
  // الوسيط يخزّن اللغات دقيقة — ننتظر انتهاء الذاكرة بعد التغيير عند الحاجة
  let en = curl("/om/en")
  for (let i = 0; i < 14 && en.code !== 404; i++) { await sleep(5000); en = curl("/om/en") }
  ok(en.code === 404, "/om/en يعطي 404", String(en.code))
  console.log("\n— بعد تفعيل الإنجليزية —")
  settings({ languages: ["ar", "en"], defaultLanguage: "ar" }, t)
  let e = curl("/om/en")
  for (let i = 0; i < 14 && e.code !== 200; i++) { await sleep(5000); e = curl("/om/en") }
  const ea = attrs(e.html)
  ok(e.code === 200 && ea.lang === "en" && ea.dir === "ltr", "/om/en إنجليزي ltr", `${e.code} ${ea.lang}/${ea.dir}`)
  ok(ea.switch, "المبدّل يظهر")
  const ar2 = curl("/om/products/printed-silk-scarf"); const a2 = attrs(ar2.html)
  ok(ar2.code === 200 && a2.lang === "ar" && /\/om\/products\/printed-silk-scarf$/.test(ar2.url), "الروابط العربية القديمة تعمل دون تغيير")
  const keep = (ar2.html.match(/data-testid="lang-switch"[^>]*href="([^"]+)"/) ?? ar2.html.match(/href="([^"]+)"[^>]*data-testid="lang-switch"/) ?? [])[1]
  ok(keep === "/om/en/products/printed-silk-scarf", "المبدّل يحفظ الصفحة نفسها", keep)
  const canon = execFileSync("curl", ["-s", "-o", "/dev/null", "-b", jar, "-m", "60", "-w", "%{http_code} %{redirect_url}", `${S}/om/ar/products/printed-silk-scarf`]).toString()
  ok(/^308 .*\/om\/products\/printed-silk-scarf$/.test(canon), "/om/ar/… يحوّل 308 إلى الصيغة القانونية", canon)
  const enp = curl("/om/en/products/printed-silk-scarf")
  ok(enp.code === 200 && attrs(enp.html).lang === "en", "صفحة منتج إنجليزية 200")
  ok(/\tlang\ten$/m.test(readFileSync(jar, "utf8")), "كوكي lang=en بعد زيارة صفحة إنجليزية (وar بعد صفحة عربية)")
  ok(enp.html.includes("icon-dir"), "الأيقونات الاتجاهية تحمل صنف القلب")
  // (ج) التكرار يُزال قبل الحفظ
  settings({ languages: ["ar", "ar", "en"] }, t)
  const langsJson = JSON.parse(execFileSync("curl", ["-s", "-m", "20", "-H", `x-publishable-api-key: ${env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}`, `${B}/store/naqla/languages`]).toString())
  ok(JSON.stringify(langsJson.languages) === JSON.stringify(["ar", "en"]), "languages: [ar, ar, en] يُحفظ بلا تكرار", JSON.stringify(langsJson.languages))
  // (أ) اللغة الافتراضية: وجهة الجذر فقط — الروابط العربية بلا بادئة
  settings({ defaultLanguage: "en" }, t)
  let root = ""
  for (let i = 0; i < 14; i++) { root = execFileSync("curl", ["-s", "-o", "/dev/null", "-m", "60", "-w", "%{redirect_url}", `${S}/?utm_source=t`]).toString(); if (/\/om\/en\/?\?utm_source=t$/.test(root)) break; await sleep(5000) }
  ok(/\/om\/en\/?\?utm_source=t$/.test(root), "defaultLanguage=en: الجذر / يحوّل إلى /om/en مع المعاملات", root)
  ok(attrs(curl("/om/products/printed-silk-scarf").html).lang === "ar", "الرابط العربي يبقى عربياً مع defaultLanguage=en")
  settings({ defaultLanguage: "ar" }, t)
  // (ب) المبدّل داخل الشاشة على 390px (رأس الصفحة) في اللغتين
  const py = `
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 390, "height": 844}); m = await c.new_page(); m.set_default_timeout(120000)
        for path in ("/om", "/om/en"):
            await m.goto("${S}" + path, wait_until="domcontentloaded"); await m.wait_for_selector("[data-testid=lang-switch]")
            bb = await m.locator("[data-testid=lang-switch]").first.bounding_box(); out[path] = bb
        await b.close()
    print(json.dumps(out))
asyncio.run(main())`
  const boxes = JSON.parse(execFileSync("python3", ["-c", py], { timeout: 280000 }).toString().trim().split("\n").pop())
  for (const [path, bb] of Object.entries(boxes)) ok(bb && bb.x >= 0 && bb.x + bb.width <= 390 && bb.width > 0, `المبدّل داخل الشاشة على 390px في ${path}`, bb ? `x=${Math.round(bb.x)} w=${Math.round(bb.width)}` : "غير موجود")
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}
async function stage1() {
  console.log("\n— المرحلة 1: نصوص الواجهة —")
  const t = tok()
  settings({ languages: ["ar", "en"], defaultLanguage: "ar" }, t)
  const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "")
  const rawKeys = (h) => (strip(h).match(/\bs[0-9a-f]{6}\b/g) ?? []).length
  // الواجهة العربية: لا مفاتيح خام، المخاطبة المؤنثة، الجمع العربي
  const arHome = curl("/om"), arProd = curl("/om/products/printed-silk-scarf")
  ok(arHome.code === 200 && rawKeys(arHome.html) === 0 && rawKeys(arProd.html) === 0, "العربية: لا مفاتيح خام في الرئيسية والمنتج")
  ok(arProd.html.includes("أضيفي للمفضلة") && arProd.html.includes("إضافة للسلة"), "العربية: المخاطبة المؤنثة (ICU select) ونص الزر")
  let en = curl("/om/en")
  for (let i = 0; i < 14 && attrs(en.html).lang !== "en"; i++) { await sleep(5000); en = curl("/om/en") }
  const AR_UI = ["إضافة للسلة", "سلة التسوق", "إتمام الطلب", "جميع الحقوق", "تتبّع طلبك", "حسابي", "دليل المقاسات", "ابحث في المتجر"]
  const pages = { "/om/en": ["All rights reserved", "My account"], "/om/en/products/printed-silk-scarf": ["Add to cart", "Size guide", "Add to wishlist"], "/om/en/cart": ["Shopping cart"], "/om/en/store": ["All products", "Sort"], "/om/en/account": ["Sign in with your phone number"], "/om/en/track": ["Track your order"] }
  for (const [path, must] of Object.entries(pages)) {
    const r = curl(path); const b = strip(r.html)
    const left = AR_UI.filter((x) => b.includes(x)), miss = must.filter((x) => !b.includes(x))
    ok(r.code === 200 && attrs(r.html).lang === "en" && rawKeys(r.html) === 0 && !left.length && !miss.length, `إنجليزي: ${path}`, [left.length ? `بقي عربي: ${left}` : "", miss.length ? `ناقص: ${miss}` : "", `خام ${rawKeys(r.html)}`].filter(Boolean).join(" | "))
  }
  // وحدة العملة تتبع اللغة: OMR في الإنجليزية (لا ر.ع)، ور.ع في العربية
  const enProd = strip(curl("/om/en/products/printed-silk-scarf").html), arProd2 = strip(curl("/om/products/printed-silk-scarf").html)
  ok(enProd.includes("OMR") && !enProd.includes("ر.ع"), "الإنجليزية: الأسعار بـ OMR بلا ر.ع", `OMR ${(enProd.match(/OMR/g) ?? []).length}، ر.ع ${(enProd.match(/ر\.ع/g) ?? []).length}`)
  ok(arProd2.includes("ر.ع"), "العربية: الأسعار بـ ر.ع (OMR يبقى في JSON-LD فقط)")
  const en404 = curl("/om/en/products/no-such-product-xyz")
  ok(en404.code === 404 && en404.html.includes("Page not found"), "404 إنجليزية مترجمة")
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}
const sections = { stage0, stage1 }
for (const s of (process.argv[3] ? [process.argv[3]] : Object.keys(sections))) await sections[s]()
console.log(`\n${failn ? "✖" : "✔"} ${pass} نجح، ${failn} فشل`)
process.exit(failn ? 1 : 0)
