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
const pk = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const sapi = (m, p, b, extraHeaders = []) => JSON.parse(execFileSync("curl", ["-s", "-m", "60", "-X", m, `${B}${p}`, "-H", "Content-Type: application/json", "-H", `x-publishable-api-key: ${pk}`, ...extraHeaders, ...(b ? ["-d", JSON.stringify(b)] : [])]).toString())
const aapi = (m, p, t, b) => JSON.parse(execFileSync("curl", ["-s", "-m", "60", "-X", m, `${B}${p}`, "-H", "Content-Type: application/json", "-H", `Authorization: Bearer ${t}`, ...(b ? ["-d", JSON.stringify(b)] : [])]).toString())
const storeJson = JSON.parse(readFileSync(new URL(`../clients/${slug}/store.json`, import.meta.url), "utf8"))
const enJson = JSON.parse(readFileSync(new URL(`../clients/${slug}/locales/en.json`, import.meta.url), "utf8"))
// أول منتج له ترجمة إنجليزية (بلا منتج الخدمة) — الاختبار يعمل على أي متجر
const HANDLE = Object.keys(enJson.products).find((h) => h !== storeJson.tailoring?.handle)
const VOICE_ADD_FAV = storeJson.voice === "f" ? "أضيفي للمفضلة" : "أضف للمفضلة"

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
  const ar2 = curl(`/om/products/${HANDLE}`); const a2 = attrs(ar2.html)
  ok(ar2.code === 200 && a2.lang === "ar" && ar2.url.endsWith(`/om/products/${HANDLE}`), "الروابط العربية القديمة تعمل دون تغيير")
  const keep = (ar2.html.match(/data-testid="lang-switch"[^>]*href="([^"]+)"/) ?? ar2.html.match(/href="([^"]+)"[^>]*data-testid="lang-switch"/) ?? [])[1]
  ok(keep === `/om/en/products/${HANDLE}`, "المبدّل يحفظ الصفحة نفسها", keep)
  const canon = execFileSync("curl", ["-s", "-o", "/dev/null", "-b", jar, "-m", "60", "-w", "%{http_code} %{redirect_url}", `${S}/om/ar/products/${HANDLE}`]).toString()
  ok(canon.startsWith("308 ") && canon.trim().endsWith(`/om/products/${HANDLE}`), "/om/ar/… يحوّل 308 إلى الصيغة القانونية", canon)
  const enp = curl(`/om/en/products/${HANDLE}`)
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
  ok(attrs(curl(`/om/products/${HANDLE}`).html).lang === "ar", "الرابط العربي يبقى عربياً مع defaultLanguage=en")
  settings({ defaultLanguage: "ar" }, t)
  // (ب) المبدّل داخل الشاشة على 390px (رأس الصفحة) في اللغتين
  const py = `
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (390, 320):
            c = await b.new_context(viewport={"width": w, "height": 844}); m = await c.new_page(); m.set_default_timeout(120000)
            for path in ("/om", "/om/en"):
                await m.goto("${S}" + path, wait_until="domcontentloaded"); await m.wait_for_selector("[data-testid=lang-switch]")
                bb = await m.locator("[data-testid=lang-switch]").first.bounding_box(); out[f"{path}@{w}"] = {**bb, "w": w}
        await b.close()
    print(json.dumps(out))
asyncio.run(main())`
  const boxes = JSON.parse(execFileSync("python3", ["-c", py], { timeout: 280000 }).toString().trim().split("\n").pop())
  for (const [path, bb] of Object.entries(boxes)) ok(bb && bb.x >= 0 && bb.x + bb.width <= bb.w && bb.width > 0, `المبدّل داخل الشاشة في ${path}`, bb ? `x=${Math.round(bb.x)} w=${Math.round(bb.width)}` : "غير موجود")
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}
async function stage1() {
  console.log("\n— المرحلة 1: نصوص الواجهة —")
  const t = tok()
  settings({ languages: ["ar", "en"], defaultLanguage: "ar" }, t)
  const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "")
  const rawKeys = (h) => (strip(h).match(/\bs[0-9a-f]{6}\b/g) ?? []).length
  // الواجهة العربية: لا مفاتيح خام، المخاطبة المؤنثة، الجمع العربي
  const arHome = curl("/om"), arProd = curl(`/om/products/${HANDLE}`)
  ok(arHome.code === 200 && rawKeys(arHome.html) === 0 && rawKeys(arProd.html) === 0, "العربية: لا مفاتيح خام في الرئيسية والمنتج")
  ok(arProd.html.includes(VOICE_ADD_FAV) && arProd.html.includes("إضافة للسلة"), "العربية: المخاطبة المؤنثة (ICU select) ونص الزر")
  let en = curl("/om/en")
  for (let i = 0; i < 14 && attrs(en.html).lang !== "en"; i++) { await sleep(5000); en = curl("/om/en") }
  const AR_UI = ["إضافة للسلة", "سلة التسوق", "إتمام الطلب", "جميع الحقوق", "تتبّع طلبك", "حسابي", "دليل المقاسات", "ابحث في المتجر"]
  const pages = { "/om/en": ["All rights reserved", "My account"], [`/om/en/products/${HANDLE}`]: ["Add to cart", "Add to wishlist"], "/om/en/cart": ["Shopping cart"], "/om/en/store": ["All products", "Sort"], "/om/en/account": ["Sign in with your phone number"], "/om/en/track": ["Track your order"] }
  for (const [path, must] of Object.entries(pages)) {
    const r = curl(path); const b = strip(r.html)
    const left = AR_UI.filter((x) => b.includes(x)), miss = must.filter((x) => !b.includes(x))
    ok(r.code === 200 && attrs(r.html).lang === "en" && rawKeys(r.html) === 0 && !left.length && !miss.length, `إنجليزي: ${path}`, [left.length ? `بقي عربي: ${left}` : "", miss.length ? `ناقص: ${miss}` : "", `خام ${rawKeys(r.html)}`].filter(Boolean).join(" | "))
  }
  // وحدة العملة تتبع اللغة: OMR في الإنجليزية (لا ر.ع)، ور.ع في العربية
  const enProd = strip(curl(`/om/en/products/${HANDLE}`).html), arProd2 = strip(curl(`/om/products/${HANDLE}`).html)
  ok(enProd.includes("OMR") && !enProd.includes("ر.ع"), "الإنجليزية: الأسعار بـ OMR بلا ر.ع", `OMR ${(enProd.match(/OMR/g) ?? []).length}، ر.ع ${(enProd.match(/ر\.ع/g) ?? []).length}`)
  ok(arProd2.includes("ر.ع"), "العربية: الأسعار بـ ر.ع (OMR يبقى في JSON-LD فقط)")
  // البطاقات (الرئيسية والمتجر) والسلة المنسدلة بمنتج فيها — باللغتين
  const cards = (h) => (strip(h).match(/<span class="price[^"]*"[^>]*>[\s\S]*?<\/span>|class="saveflag"[^>]*>[^<]*/g) ?? []).join(" ")
  const reg = sapi("GET", "/store/regions").regions[0].id
  // أول متغيّر متوفر (مشتريات الاختبارات السابقة قد تستنفد الأول)
  const vs = sapi("GET", `/store/products?handle=${HANDLE}&region_id=${reg}&fields=*variants,+variants.inventory_quantity,+variants.manage_inventory`).products[0].variants
  const v = (vs.find((x) => !x.manage_inventory || x.inventory_quantity > 0) ?? vs[0]).id
  const cartId = sapi("POST", "/store/carts", { region_id: reg }).cart.id
  sapi("POST", `/store/carts/${cartId}/line-items`, { variant_id: v, quantity: 1 })
  const jarText = readFileSync(jar, "utf8")
  require_fs: { const { writeFileSync } = await import("node:fs"); writeFileSync(jar, jarText + `localhost\tFALSE\t/\tFALSE\t0\t_medusa_cart_id\t${cartId}\n`) }
  for (const [path, unit, bad] of [["/om", "ر.ع", "OMR"], ["/om/store", "ر.ع", "OMR"], ["/om/en", "OMR", "ر.ع"], ["/om/en/store", "OMR", "ر.ع"]]) {
    const c = cards(curl(path).html)
    ok(c.includes(unit) && !c.includes(bad), `وحدة العملة في بطاقات ${path}`, `${(c.match(new RegExp(unit, "g")) ?? []).length} بطاقة بـ${unit}، ${(c.match(new RegExp(bad, "g")) ?? []).length} بـ${bad}`)
  }
  // السلة بمنتج فيها (الصفحة؛ المنسدلة Popover لا تُرسم في HTML وتستخدم الدالة نفسها المُلزمة باللغة)
  for (const [path, unit, bad] of [["/om/cart", "ر.ع", "OMR"], ["/om/en/cart", "OMR", "ر.ع"]]) {
    const tot = (strip(curl(path).html).match(/class="tot"[\s\S]*?<\/div>/) ?? [""])[0]
    ok(tot.includes(unit) && !tot.includes(bad), `وحدة العملة في مجموع السلة ${path}`, tot.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60))
  }
  sapi("DELETE", `/store/carts/${cartId}/line-items/${(sapi("GET", `/store/carts/${cartId}`).cart.items[0] ?? {}).id}`)
  const en404 = curl("/om/en/products/no-such-product-xyz")
  ok(en404.code === 404 && en404.html.includes("Page not found"), "404 إنجليزية مترجمة")
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}

/** نص الصفحة بلا سكربتات/SVG/سمات؛ ويُستثنى اسم المتجر (علامة تجارية) وتسمية المبدّل «العربية» */
const visibleText = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ")
const arabicLeft = (h) => {
  let txt = visibleText(h)
  for (const n of [storeJson.name, storeJson.shortName, "العربية", "ر.ع"]) txt = txt.split(n).join(" ")
  return [...new Set(txt.match(/[؀-ۿ][؀-ۿ\s]*/g) ?? [])].map((x) => x.trim()).filter((x) => x.length > 1)
}
const PY_HEAD = `
import asyncio, json, sys, re
from playwright.async_api import async_playwright
S = ${JSON.stringify(S)}
async def pick_options(m):
    for grp in await m.locator(".opts[role=radiogroup]").all():
        if await grp.locator("[role=radio][aria-checked=true]").count() == 0:
            await grp.locator("[role=radio]:not([disabled])").first.click()
`
async function stage2() {
  console.log("\n— المرحلة 2: المحتوى —")
  const t = tok()
  settings({ languages: ["ar", "en"], defaultLanguage: "ar" }, t)
  let en = curl("/om/en")
  for (let i = 0; i < 14 && attrs(en.html).lang !== "en"; i++) { await sleep(5000); en = curl("/om/en") }
  const reg = sapi("GET", "/store/regions").regions[0].id
  // 1) الصفحات الرئيسية بالإنجليزية بلا نص عربي (المحتوى من الترجمات وstore.json المترجم)
  const cat = Object.keys(enJson.categories ?? {})[0]
  const pages = ["/om/en", "/om/en/store", `/om/en/products/${HANDLE}`, `/om/en/categories/${cat}`, "/om/en/cart", "/om/en/account", "/om/en/track", "/om/en/pages/about"]
  for (const p of pages) {
    const r = curl(p); const left = arabicLeft(r.html)
    ok(r.code === 200 && attrs(r.html).lang === "en" && left.length === 0, `بلا عربي: ${p}`, left.length ? `بقي: ${left.slice(0, 5).join(" | ")}` : "")
  }
  // 2) المنتج والخيارات: الاسم والوصف الإنجليزيان، أسماء الخيارات وقيمها، الدوائر والسعر والزر كما في العربية
  const enP = curl(`/om/en/products/${HANDLE}`).html, arP = curl(`/om/products/${HANDLE}`).html
  const tr = enJson.products[HANDLE]
  ok(enP.includes(tr.title) && !enP.includes(`>${tr.title}<`) === false || enP.includes(tr.title), "المنتج: الاسم الإنجليزي من وحدة الترجمة", tr.title)
  const prodAr = sapi("GET", `/store/products?handle=${HANDLE}&region_id=${reg}&fields=*options,*options.values,*variants`).products[0]
  const prodEn = sapi("GET", `/store/products?handle=${HANDLE}&region_id=${reg}&fields=*options,*options.values,*variants&locale=en-US`).products[0]
  ok(prodEn.title === tr.title && prodAr.title !== tr.title, "Store API: ?locale=en-US يعيد العنوان الإنجليزي والعربية الأصل", `${prodAr.title} → ${prodEn.title}`)
  const optsEn = (prodEn.options ?? []).map((o) => o.title), optsAr = (prodAr.options ?? []).map((o) => o.title)
  const expectOpts = optsAr.map((a) => enJson.options?.[a]?.title ?? a)
  ok(JSON.stringify(optsEn) === JSON.stringify(expectOpts), "أسماء الخيارات مترجمة", `${optsAr} → ${optsEn}`)
  const valsEn = (prodEn.options ?? []).flatMap((o) => o.values.map((v) => v.value)), valsExpect = (prodAr.options ?? []).flatMap((o) => o.values.map((v) => enJson.options?.[o.title]?.values?.[v.value] ?? v.value))
  ok(JSON.stringify([...valsEn].sort()) === JSON.stringify([...valsExpect].sort()), "قيم الخيارات مترجمة (ما لا ترجمة له يبقى كما هو)", `${valsEn.slice(0, 5)}`)
  ok((prodAr.options ?? []).every((o) => o.metadata?.key || !storeJson.options?.some((c) => c.title === o.title)), "المطابقة بمفاتيح ثابتة metadata.key", (prodAr.options ?? []).map((o) => `${o.title}:${o.metadata?.key ?? "-"}`).join(" "))
  const sw = (h) => (h.match(/class="sw"/g) ?? []).length
  ok(sw(enP) === sw(arP), "دوائر الألوان بالعدد نفسه في اللغتين", `${sw(arP)}/${sw(enP)}`)
  ok(/OMR/.test(visibleText(enP)) && enP.includes("add-product-button") && enP.includes("Add to cart"), "السعر (OMR) وزر الإضافة في صفحة المنتج الإنجليزية")
  // 3) منتج بلا ترجمة يظهر بالعربية دون كسر (نحذف ترجمته مؤقتاً ثم نعيدها)
  const trRows = aapi("GET", `/admin/translations?locale_code=en-US&reference_id[]=${prodAr.id}&limit=10`, t).translations
  const mine = trRows.find((r) => r.reference === "product")
  aapi("POST", "/admin/translations/batch", t, { delete: [mine.id] })
  let fb = curl(`/om/en/products/${HANDLE}`)
  for (let i = 0; i < 14 && fb.html.includes(tr.title); i++) { await sleep(5000); fb = curl(`/om/en/products/${HANDLE}`) }
  ok(fb.code === 200 && attrs(fb.html).lang === "en" && fb.html.includes(prodAr.title) && !fb.html.includes(tr.title) && fb.html.includes("Add to cart"), "منتج بلا ترجمة: الاسم بالعربية والواجهة بالإنجليزية دون كسر")
  aapi("POST", "/admin/translations/batch", t, { create: [{ reference: "product", reference_id: prodAr.id, locale_code: "en-US", translations: mine.translations }] })
  let back = curl(`/om/en/products/${HANDLE}`)
  for (let i = 0; i < 14 && !back.html.includes(tr.title); i++) { await sleep(5000); back = curl(`/om/en/products/${HANDLE}`) }
  ok(back.html.includes(tr.title), "استعادة الترجمة تنعكس في الواجهة (إبطال الذاكرة عند تغيّر الترجمات)")
  // 4) البحث بكلمة إنجليزية من الكتالوج وبكلمة عربية
  const enWord = tr.title.split(/\s+/).filter((w) => w.length > 3).pop(), arWord = prodAr.title.split(/\s+/).filter((w) => w.length > 2).pop()
  const sEn = sapi("GET", `/store/search?q=${encodeURIComponent(enWord)}`), sAr = sapi("GET", `/store/search?q=${encodeURIComponent(arWord)}`)
  ok(sEn.ids?.includes(prodAr.id), `البحث بالإنجليزية «${enWord}» يجد المنتج`, `${sEn.ids?.length ?? 0} نتيجة`)
  ok(sAr.ids?.includes(prodAr.id), `البحث بالعربية «${arWord}» يجد المنتج`, `${sAr.ids?.length ?? 0} نتيجة`)
  // 5) شراء كامل بالإنجليزية (متصفح): السلة ← الدفع ← التأكيد؛ الطلب يحمل locale=en-US
  curl("/om/en/checkout?step=address") // تسخين تجميع صفحة الدفع في وضع التطوير
  const govAr = storeJson.checkout.governorates[0], govEn = enJson.store.checkout?.governorates?.[0]
  const py = PY_HEAD + `
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 1280, "height": 900}); m = await c.new_page(); m.set_default_timeout(120000)
        await m.goto(S + "/om/en/products/${HANDLE}", wait_until="domcontentloaded")
        await m.wait_for_selector("[data-testid=add-product-button]")
        await pick_options(m)
        # النقر قبل اكتمال الترطيب (hydration) يضيع في وضع التطوير: نكرر حتى تظهر كوكي السلة
        for attempt in range(5):
            await m.click("[data-testid=add-product-button]:not([disabled])")
            for _ in range(10):
                await m.wait_for_timeout(500)
                if any(ck["name"] == "_medusa_cart_id" for ck in await c.cookies()): break
            if any(ck["name"] == "_medusa_cart_id" for ck in await c.cookies()): break
        await m.wait_for_timeout(2000)
        for attempt in range(3):
            await m.goto(S + "/om/en/cart", wait_until="domcontentloaded")
            try:
                await m.wait_for_selector(".cname", timeout=90000); break
            except Exception:
                if attempt == 2:
                    print("CART PAGE:", " | ".join((await m.locator("body").inner_text())[:600].splitlines()), file=sys.stderr); raise
                await m.wait_for_timeout(3000)
        out["cart"] = await m.locator("main").inner_text()
        await m.goto(S + "/om/en/checkout?step=address", wait_until="domcontentloaded")
        await m.wait_for_selector("#fName")
        await m.wait_for_load_state("networkidle")
        await m.fill("#fName", "Test Customer"); await m.fill("#fPhone", "91234567")
        for attempt in range(6):  # الاختيار قبل الترطيب لا يصل إلى React: نكرر حتى تُفعَّل قائمة الولايات
            await m.select_option("#fGov", ${JSON.stringify(govAr.code)})
            try:
                await m.wait_for_selector("#fCity:not([disabled])", timeout=5000); break
            except Exception:
                if attempt == 5: raise
        out["govLabel"] = await m.locator("#fGov option:checked").inner_text()
        await m.select_option("#fCity", index=1)
        out["wilLabel"] = await m.locator("#fCity option:checked").inner_text()
        out["wilValue"] = await m.locator("#fCity").input_value()
        await m.fill("#fAddr", "Street 1, Building 2")
        await m.click("[data-testid=to-payment]")
        await m.wait_for_selector("[data-testid=place-order]")
        if await m.locator("[data-testid=pay-cod]").count(): await m.click("[data-testid=pay-cod]")
        out["checkout"] = await m.locator("main").inner_text()
        await m.click("[data-testid=place-order]:not([disabled])")
        await m.wait_for_url(re.compile(r"/order/.+/confirmed"), timeout=120000)
        out["url"] = m.url
        out["confirm"] = await m.locator("main").inner_text()
        html = await m.content(); out["lang"] = re.search(r'<html[^>]*lang="([^"]+)"', html).group(1)
        await b.close()
    print(json.dumps(out))
asyncio.run(main())`
  const r = JSON.parse(execFileSync("python3", ["-c", py], { timeout: 400000 }).toString().trim().split("\n").pop())
  const orderId = (r.url.match(/\/order\/([^/]+)\/confirmed/) ?? [])[1]
  ok(!!orderId && r.lang === "en", "شراء كامل بالإنجليزية: صفحة التأكيد", r.url.replace(S, ""))
  const order = aapi("GET", `/admin/orders/${orderId}?fields=id,locale,display_id,shipping_address.city,shipping_address.province,*items`, t).order
  ok(order?.locale === "en-US", "الطلب يحمل locale=en-US", String(order?.locale))
  ok(order?.shipping_address?.city === r.wilValue && /[؀-ۿ]/.test(r.wilValue) && !/[؀-ۿ]/.test(r.wilLabel), "العنوان يُخزَّن بالعربية (الولاية) والقائمة تعرضه بالإنجليزية", `${r.wilLabel} ← ${r.wilValue}`)
  ok(govEn ? r.govLabel === govEn.name : true, "اسم المحافظة بالإنجليزية في الدفع", r.govLabel)
  const arIn = (txt) => { for (const n of [storeJson.name, storeJson.shortName, "العربية"]) txt = txt.split(n).join(" "); return [...new Set(txt.match(/[؀-ۿ]{2,}/g) ?? [])] }
  ok(r.cart.includes(tr.title) && arIn(r.cart).length === 0, "السلة بالإنجليزية: اسم المنتج وقيم الخيارات من الترجمات", arIn(r.cart).slice(0, 4).join(" | "))
  ok(arIn(r.checkout).length === 0, "صفحة الدفع بالإنجليزية بلا عربي", arIn(r.checkout).slice(0, 4).join(" | "))
  ok(r.confirm.includes(tr.title) && arIn(r.confirm).length === 0 && r.confirm.includes(r.wilLabel), "رسالة التأكيد بالإنجليزية (المنتج، الولاية)", arIn(r.confirm).slice(0, 4).join(" | "))
  // 6) تتبّع الطلب بالإنجليزية (الضيفة: رقم الطلب + الهاتف)
  const no = `${storeJson.checkout.orderPrefix}${String(order.display_id).padStart(4, "0")}`
  const py2 = PY_HEAD + `
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); m = await (await b.new_context()).new_page(); m.set_default_timeout(120000)
        await m.goto(S + "/om/en/track", wait_until="domcontentloaded")
        await m.wait_for_load_state("networkidle")
        for attempt in range(4):  # الإرسال قبل الترطيب يضيع في وضع التطوير
            await m.fill("#tNo", ${JSON.stringify(no)}); await m.fill("#tPh", "91234567")
            await m.click("[data-testid=track-btn]")
            try:
                await m.wait_for_selector("text=${tr.title}", timeout=30000); break
            except Exception:
                if attempt == 3: raise
                await m.goto(S + "/om/en/track", wait_until="domcontentloaded"); await m.wait_for_load_state("networkidle")
        print(json.dumps({"text": await m.locator("main").inner_text()}))
        await b.close()
asyncio.run(main())`
  const tr2 = JSON.parse(execFileSync("python3", ["-c", py2], { timeout: 200000 }).toString().trim().split("\n").pop())
  ok(tr2.text.includes(tr.title) && arIn(tr2.text).length === 0, "تتبّع الطلب بالإنجليزية: المنتج والحالة والمكان", arIn(tr2.text).slice(0, 4).join(" | "))
  // 7) الطلب العربي يحمل ar-SA
  const cartAr = sapi("POST", "/store/carts", { region_id: reg, locale: "ar-SA" }).cart
  ok(cartAr.locale === "ar-SA", "السلة العربية تحمل locale=ar-SA", cartAr.locale)
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}

async function stage3() {
  console.log("\n— المرحلة 3: السيو —")
  const t = tok()
  const links = (h) => [...h.matchAll(/<link[^>]+rel="alternate"[^>]+>/g)].map((m) => m[0]).filter((x) => /hreflang=/i.test(x))
  const hreflang = (h) => Object.fromEntries(links(h).map((x) => [(x.match(/hreflang="([^"]+)"/i) ?? [])[1], (x.match(/href="([^"]+)"/) ?? [])[1]]))
  const meta = (h, prop) => (h.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`)) ?? h.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`)) ?? [])[1]
  const canonical = (h) => (h.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) ?? [])[1]
  const jsonLds = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]) } catch { return null } }).filter(Boolean)
  // متجر بلغة واحدة: لا hreflang، sitemap عربي فقط، كتالوج ?lang=en ← 404
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
  let h = curl("/om")
  for (let i = 0; i < 14 && attrs(h.html).switch; i++) { await sleep(5000); h = curl("/om") }
  ok(links(h.html).length === 0 && canonical(h.html)?.endsWith("/om"), "لغة واحدة: لا hreflang وcanonical عربي", canonical(h.html))
  const sm1 = curl("/sitemap.xml")
  ok(sm1.code === 200 && !sm1.html.includes("/om/en") && !sm1.html.includes("hreflang"), "لغة واحدة: sitemap عربي بلا /en", `${(sm1.html.match(/<url>/g) ?? []).length} رابط`)
  ok(curl("/feeds/google.xml?lang=en").code === 404, "لغة واحدة: /feeds/google.xml?lang=en يعطي 404")
  // بعد تفعيل الإنجليزية
  settings({ languages: ["ar", "en"], defaultLanguage: "ar" }, t)
  let en = curl("/om/en")
  for (let i = 0; i < 14 && attrs(en.html).lang !== "en"; i++) { await sleep(5000); en = curl("/om/en") }
  // الصفحات العربية المخزَّنة قبل التفعيل تُعاد بعد إبطال الذاكرة (حتى دقيقة)
  for (let i = 0; i < 14 && links(curl("/om").html).length === 0; i++) await sleep(5000)
  for (const [path, enPath] of [["/om", "/om/en"], [`/om/products/${HANDLE}`, `/om/en/products/${HANDLE}`], ["/om/store", "/om/en/store"], ["/om/pages/about", "/om/en/pages/about"]]) {
    const a = curl(path).html, b = curl(enPath).html, ha = hreflang(a), hb = hreflang(b)
    const want = (x) => x.ar?.endsWith(path) && x.en?.endsWith(enPath) && x["x-default"]?.endsWith(path)
    ok(want(ha) && want(hb) && canonical(a)?.endsWith(path) && canonical(b)?.endsWith(enPath), `hreflang (ar/en/x-default=ar) وcanonical: ${path}`, `ar=${ha.ar} en=${ha.en} x=${ha["x-default"]}`)
    ok(meta(a, "og:locale") === "ar_OM" && meta(b, "og:locale") === "en_US" && meta(a, "og:locale:alternate") === "en_US" && meta(b, "og:locale:alternate") === "ar_OM", `og:locale حسب اللغة: ${path}`, `${meta(a, "og:locale")} / ${meta(b, "og:locale")}`)
  }
  // JSON-LD: الرئيسية (WebSite/Organization/Store) والمنتج (Product/Breadcrumb) بلغة الصفحة
  const homeAr = jsonLds(curl("/om").html), homeEn = jsonLds(curl("/om/en").html)
  const site = (arr) => arr.flatMap((x) => x["@graph"] ?? [x]).find((x) => x["@type"] === "WebSite")
  const store = (arr) => arr.flatMap((x) => x["@graph"] ?? [x]).find((x) => x["@type"] === "Store")
  ok(site(homeAr)?.inLanguage === "ar" && site(homeEn)?.inLanguage === "en" && site(homeEn)?.url?.endsWith("/om/en"), "JSON-LD الرئيسية: inLanguage وurl بلغة الصفحة", `${site(homeAr)?.inLanguage}/${site(homeEn)?.inLanguage}`)
  ok(store(homeEn) && !/[؀-ۿ]/.test(JSON.stringify([store(homeEn).address, store(homeEn).name])), "JSON-LD المحل بالإنجليزية (الاسم والعنوان)", String(store(homeEn)?.address?.addressLocality))
  const prodEn = jsonLds(curl(`/om/en/products/${HANDLE}`).html), P = prodEn.find((x) => x["@type"] === "Product"), B = prodEn.find((x) => x["@type"] === "BreadcrumbList")
  ok(P?.inLanguage === "en" && P?.name === enJson.products[HANDLE].title && P?.offers?.url?.includes("/om/en/products/"), "JSON-LD المنتج بالإنجليزية (name، inLanguage، offers.url)", P?.name)
  ok(B && B.itemListElement.every((x) => !/[؀-ۿ]/.test(x.name) && x.item.includes("/om/en")) , "JSON-LD مسار التنقل بالإنجليزية", B?.itemListElement?.map((x) => x.name).join(" › "))
  const prodAr = jsonLds(curl(`/om/products/${HANDLE}`).html).find((x) => x["@type"] === "Product")
  ok(prodAr?.inLanguage === "ar" && /[؀-ۿ]/.test(prodAr?.name ?? ""), "JSON-LD المنتج العربي كما كان")
  // sitemap باللغتين مع alternates
  let sm = curl("/sitemap.xml")
  for (let i = 0; i < 14 && !sm.html.includes("/om/en"); i++) { await sleep(5000); sm = curl("/sitemap.xml") }
  const urls = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const arUrls = urls.filter((u) => !u.includes("/om/en")), enUrls = urls.filter((u) => u.includes("/om/en"))
  ok(enUrls.length === arUrls.length && enUrls.length > 5 && enUrls.some((u) => u.endsWith(`/om/en/products/${HANDLE}`)), "sitemap: كل رابط باللغتين", `${arUrls.length} عربي / ${enUrls.length} إنجليزي`)
  ok(sm.html.includes('hreflang="en"') && sm.html.includes('hreflang="x-default"'), "sitemap: xhtml:link hreflang (ar/en/x-default)")
  // كتالوجات ?lang=en
  const gEn = curl("/feeds/google.xml?lang=en"), gAr = curl("/feeds/google.xml")
  const titles = (x) => [...x.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]).slice(1)
  ok(gEn.code === 200 && titles(gEn.html).some((x) => x.includes(enJson.products[HANDLE].title)) && gEn.html.includes(`/om/en/products/`), "كتالوج Google بالإنجليزية: عناوين مترجمة وروابط /en", titles(gEn.html)[0])
  ok(titles(gAr.html).some((x) => /[؀-ۿ]/.test(x)) && !gAr.html.includes("/om/en/"), "كتالوج Google العربي كما كان")
  const mEn = curl("/feeds/meta.csv?lang=en")
  ok(mEn.code === 200 && mEn.html.includes(enJson.products[HANDLE].title) && mEn.html.includes("/om/en/products/"), "كتالوج Meta بالإنجليزية")
  // لا عربي في عنوان أو وصف أي صف لمنتج مترجم (اسم المتغيّر من قيم الخيارات المترجمة، لا من variant.title)
  const translated = new Set(Object.keys(enJson.products))
  const arabic = (x) => /[\u0600-\u06FF]/.test(x)
  const gItems = [...gEn.html.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({ group: (m[1].match(/<g:item_group_id>([^<]*)</) ?? [])[1], title: (m[1].match(/<title>([^<]*)</) ?? [])[1] ?? "", desc: (m[1].match(/<description>([^<]*)</) ?? [])[1] ?? "", brand: (m[1].match(/<g:brand>([^<]*)</) ?? [])[1] ?? "" }))
  const gBad = gItems.filter((i) => translated.has(i.group) && (arabic(i.title) || arabic(i.desc)))
  ok(gItems.length > 0 && gBad.length === 0, "كتالوج Google الإنجليزي: لا عربي في عنوان/وصف المنتجات المترجمة", gBad.length ? `${gBad.length}/${gItems.length}: ${gBad[0].title}` : `${gItems.length} صفاً`)
  const csvRows = (txt) => { const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < txt.length; i++) { const ch = txt[i]; if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch } else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = "" } else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = "" } else if (ch !== "\r") cell += ch } if (cell || row.length) { row.push(cell); rows.push(row) } return rows }
  const [head, ...rows] = csvRows(mEn.html.replace(/^\uFEFF/, ""))
  const col = (name) => head.indexOf(name)
  const mBad = rows.filter((r) => translated.has(r[col("item_group_id")]) && (arabic(r[col("title")] ?? "") || arabic(r[col("description")] ?? "")))
  ok(rows.length > 0 && mBad.length === 0, "كتالوج Meta الإنجليزي: لا عربي في عنوان/وصف المنتجات المترجمة", mBad.length ? `${mBad.length}/${rows.length}: ${mBad[0][col("title")]}` : `${rows.length} صفاً`)
  // اسم المتجر الإنجليزي (store.name في en.json): g:brand وعنوان القناة وOrganization/WebSite
  const enName = enJson.store?.name
  const chTitle = (gEn.html.match(/<channel>\s*<title>([^<]*)</) ?? [])[1]
  const org = homeEn.flatMap((x) => x["@graph"] ?? [x]).find((x) => x["@type"] === "Organization")
  ok(!enName || (gItems.every((i) => i.brand === enName) && chTitle === enName && org?.name === enName && site(homeEn)?.name === enName), "اسم المتجر الإنجليزي في g:brand وعنوان القناة وOrganization/WebSite", `${chTitle} / ${org?.name}`)
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}

/** لقطة الواجهة العربية (متجر بلغة واحدة): تُسجَّل بـ --snapshot وتُقارَن بعدها — الأرقام وتسميات المبدّل مستثناة */
async function arSnapshot() {
  console.log("\n— لقطة الواجهة العربية —")
  const { existsSync, mkdirSync, writeFileSync } = await import("node:fs")
  const t = tok()
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
  writeFileSync(jar, "") // جرّة كوكي نظيفة: لا سلة من اختبارات سابقة
  let h = curl("/om")
  for (let i = 0; i < 14 && attrs(h.html).switch; i++) { await sleep(5000); h = curl("/om") }
  const norm = (html) => visibleText(html).replace(/[0-9٠-٩.,:]+/g, "#").replace(/\s+/g, " ").trim()
  const pages = ["/om", "/om/store", `/om/products/${HANDLE}`, "/om/cart", "/om/account", "/om/track"]
  const snap = Object.fromEntries(pages.map((p) => [p, norm(curl(p).html)]))
  const dir = new URL("../.i18n-snapshots/", import.meta.url), file = new URL(`../.i18n-snapshots/${slug}.json`, import.meta.url)
  if (process.argv.includes("--snapshot") || !existsSync(file)) {
    mkdirSync(dir, { recursive: true }); writeFileSync(file, JSON.stringify(snap, null, 1))
    for (const p of pages) ok(snap[p].length > 200 && /[؀-ۿ]/.test(snap[p]), `لقطة ${p} سُجّلت`, `${snap[p].length} حرفاً`)
    return
  }
  const prev = JSON.parse(readFileSync(file, "utf8"))
  for (const p of pages) {
    const same = prev[p] === snap[p]
    let diff = ""
    if (!same) { const a = prev[p].split(" "), b = snap[p].split(" "); diff = `فُقد: ${a.filter((x) => !b.includes(x)).slice(0, 4).join(" ")} | جديد: ${b.filter((x) => !a.includes(x)).slice(0, 4).join(" ")}` }
    ok(same, `الواجهة العربية كما كانت: ${p}`, diff)
  }
}
const sections = { stage0, stage1, stage2, stage3, arSnapshot }
for (const s of (process.argv[3] && !process.argv[3].startsWith("--") ? [process.argv[3]] : Object.keys(sections))) await sections[s]()
console.log(`\n${failn ? "✖" : "✔"} ${pass} نجح، ${failn} فشل`)
process.exit(failn ? 1 : 0)
