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
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t); await sleep(4000)
  curl("/om") // كوكي المنطقة
  const ar = curl("/om"); const a = attrs(ar.html)
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
  settings({ languages: ["ar"], defaultLanguage: "ar" }, t)
}
const sections = { stage0 }
for (const s of (process.argv[3] ? [process.argv[3]] : Object.keys(sections))) await sections[s]()
console.log(`\n${failn ? "✖" : "✔"} ${pass} نجح، ${failn} فشل`)
process.exit(failn ? 1 : 0)
