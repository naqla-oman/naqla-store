import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve4 } from "node:dns/promises"
import { join } from "node:path"
import { audit, currentAdmin } from "./auth"
import { q } from "./db"
import { enqueue } from "./jobs"
import { ROOT } from "./provisioner/local"

/** منطق مسارات اللوحة (التحقق على الخادم، والتنفيذ عبر الطابور فقط) */
export class ApiError extends Error { constructor(message: string, public status = 400) { super(message) } }
export async function admin() {
  const a = await currentAdmin()
  if (!a) throw new ApiError("غير مصرّح", 401)
  return a
}
export const json = (fn: () => Promise<unknown>) => fn().then((b) => Response.json(b)).catch((e) => Response.json({ error: e.message }, { status: e instanceof ApiError ? e.status : 500 }))

export const presets = () => JSON.parse(readFileSync(join(ROOT, "themes", "presets.json"), "utf8")) as { palettes: { slug: string; name: string; use?: string; light: Record<string, string> }[]; fonts: { slug: string; name: string; display: string; body: string }[] }
export const templates = () => readdirSync(join(ROOT, "templates")).filter((t) => existsSync(join(ROOT, "templates", t, "template.json")))
  .map((t) => ({ id: t, ...JSON.parse(readFileSync(join(ROOT, "templates", t, "template.json"), "utf8")) }))

const RESERVED = new Set(["admin", "api", "app", "www", "console", "naqla", "mail", "static", "template", "_template"])
export async function slugIssue(slug: string): Promise<string | null> {
  if (!/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(slug)) return "الرمز: حروف لاتينية صغيرة وأرقام وشرطات (3–30) يبدأ بحرف"
  if (RESERVED.has(slug)) return "الرمز محجوز"
  const [row] = await q(`select status from stores where slug=$1`, [slug])
  if (row && row.status !== "deleted") return "الرمز مستخدم لمتجر آخر"
  if (existsSync(join(ROOT, "clients", slug))) return "يوجد مجلد عميل بهذا الرمز"
  return null
}
/** اقتراح رمز لاتيني من الاسم (أحرف لاتينية إن وُجدت، وإلا store-<n>) مع ضمان التفرّد */
export async function suggestSlug(name: string) {
  const AR: Record<string, string> = { ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "th", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w", ي: "y", ى: "a", ئ: "e", ؤ: "o", ء: "" }
  let base = [...name.trim().toLowerCase()].map((ch) => (/[a-z0-9]/.test(ch) ? ch : AR[ch] ?? (/\s|-/.test(ch) ? "-" : ""))).join("")
  base = base.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "store"
  if (!/^[a-z]/.test(base)) base = `s-${base}`
  for (let i = 0; i < 50; i++) { const s = i ? `${base}-${i + 1}` : base; if (!(await slugIssue(s))) return s }
  return `${base}-${Date.now() % 10000}`
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
export async function createStore(body: any) {
  const a = await admin()
  const slug = String(body.slug ?? "").trim()
  const issue = await slugIssue(slug); if (issue) throw new ApiError(issue)
  const name = String(body.name ?? "").trim(); if (name.length < 2 || name.length > 60 || /[<>]/.test(name)) throw new ApiError("اسم المتجر: 2–60 حرفاً")
  const phone = String(body.phone ?? "").replace(/\D/g, ""); if (!/^\d{8,15}$/.test(phone)) throw new ApiError("جوال العميل: أرقام مع رمز الدولة")
  const email = String(body.email ?? "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApiError("بريد العميل غير صحيح")
  if (!templates().some((t) => t.id === body.template)) throw new ApiError("القالب غير معروف")
  const p = presets()
  if (body.palette && !p.palettes.some((x) => x.slug === body.palette)) throw new ApiError("لوحة الألوان غير معروفة")
  if (body.font && !p.fonts.some((x) => x.slug === body.font)) throw new ApiError("زوج الخطوط غير معروف")
  if (body.voice && !["f", "m", "neutral"].includes(body.voice)) throw new ApiError("المخاطبة غير صحيحة")
  let logoPng: string | undefined
  if (body.logo) {
    const buf = Buffer.from(String(body.logo).replace(/^data:image\/png;base64,/, ""), "base64")
    if (buf.length > 2 * 1024 * 1024 || !buf.subarray(0, 8).equals(PNG)) throw new ApiError("الشعار: PNG حتى 2MB")
    logoPng = buf.toString("base64")
  }
  const features = Object.fromEntries(Object.entries(body.features ?? {}).filter(([k, v]) => /^[a-zA-Z]+$/.test(k) && typeof v === "boolean"))
  const domain = body.domainType === "custom" ? String(body.domain ?? "").trim().toLowerCase() : `${slug}.${process.env.PLATFORM_DOMAIN || "naqla.local"}`
  if (body.domainType === "custom" && !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) throw new ApiError("الدومين غير صحيح")
  const languages = body.english === true ? ["ar", "en"] : ["ar"]
  const spec = { slug, name, phone, email, template: body.template, languages, palette: body.palette || undefined, font: body.font || undefined, voice: body.voice || undefined, features, domain }
  await q(`insert into stores (slug, name, template, status, domain, phone, email, meta) values ($1,$2,$3,'provisioning',$4,$5,$6,$7)
    on conflict (slug) do update set name=$2, template=$3, status='provisioning', domain=$4, phone=$5, email=$6, meta=$7, created_at=now()`,
    [slug, name, body.template, domain, phone, email, JSON.stringify(spec)])
  const jobId = await enqueue("create", slug, { ...spec, logoPng }, a.email)
  await audit("store.create", { email: a.email, target: slug, detail: { template: body.template, jobId } })
  return { slug, jobId }
}

const ACTIONS = new Set(["pause", "resume", "update", "backup", "restore", "reset_link", "delete"])
export async function storeAction(slug: string, action: string, body: any) {
  const a = await admin()
  if (!ACTIONS.has(action)) throw new ApiError("عملية غير معروفة")
  const [s] = await q(`select * from stores where slug=$1 and status <> 'deleted'`, [slug])
  if (!s) throw new ApiError("المتجر غير موجود", 404)
  // العمليات الخطرة: تأكيد مكتوب برمز المتجر
  if ((action === "delete" || action === "restore") && body?.confirm !== slug) throw new ApiError(`للتأكيد اكتب رمز المتجر: ${slug}`)
  if (action === "restore" && !body?.backupId) throw new ApiError("اختر النسخة")
  const jobId = await enqueue(action, slug, { name: s.name, phone: s.phone, backupId: body?.backupId }, a.email)
  await audit(`store.${action}`, { email: a.email, target: slug, detail: { jobId, backupId: body?.backupId } })
  return { jobId }
}

/** الدومين المخصص: يتحقق أن سجل A يشير لعنوان المنصة (PLATFORM_IP) */
export async function checkDomain(domain: string) {
  await admin()
  const ip = process.env.PLATFORM_IP
  try {
    const addrs = await resolve4(domain)
    return { ok: !!ip && addrs.includes(ip), addrs, expected: ip ?? "(يُحدَّد PLATFORM_IP عند النشر)" }
  } catch { return { ok: false, addrs: [], expected: ip ?? "(يُحدَّد PLATFORM_IP عند النشر)" } }
}
