"use client"
import { useEffect, useState } from "react"

type Palette = { slug: string; name: string; use?: string; light: Record<string, string> }
type Font = { slug: string; name: string; display: string; body: string }
type Tpl = { id: string; name: string; description: string; products: number; categories: number }
const FEATURES: [string, string][] = [
  ["cod", "الدفع عند الاستلام"], ["whatsappOrder", "الطلب عبر واتساب"], ["thawani", "ثواني (بعد إدخال مفاتيحه)"], ["expressDelivery", "التوصيل السريع"],
  ["pickup", "الاستلام من المحل"], ["loyalty", "نقاط الولاء"], ["loyaltyTiers", "مستويات الولاء"], ["gift", "الطلب هدية"], ["reviews", "التقييمات"],
]
const STEPS = ["بيانات العميل", "القالب", "الهوية", "الميزات والمخاطبة", "الدومين", "المراجعة"]

export default function Wizard({ templates, palettes, fonts, platformDomain }: { templates: Tpl[]; palettes: Palette[]; fonts: Font[]; platformDomain: string }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Record<string, any>>({ template: "fashion", voice: "f", domainType: "sub", features: { cod: true, whatsappOrder: true, thawani: false, expressDelivery: true, pickup: true, loyalty: true, loyaltyTiers: true, gift: true, reviews: false } })
  const [slugMsg, setSlugMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dns, setDns] = useState<string | null>(null)
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => { // اقتراح الرمز من الاسم
    if (!f.name || f.slugTouched) return
    const t = setTimeout(() => fetch(`/api/slug?name=${encodeURIComponent(f.name)}`).then((r) => r.json()).then((d) => d.slug && setF((x) => ({ ...x, slug: d.slug }))), 400)
    return () => clearTimeout(t)
  }, [f.name, f.slugTouched])
  useEffect(() => { // التحقق من التفرّد
    if (!f.slug) return
    const t = setTimeout(() => fetch(`/api/slug?slug=${encodeURIComponent(f.slug)}`).then((r) => r.json()).then((d) => setSlugMsg(d.issue ?? null)), 300)
    return () => clearTimeout(t)
  }, [f.slug])

  const valid = [
    () => f.name?.trim().length >= 2 && f.slug && !slugMsg && /^\d{8,15}$/.test(String(f.phone ?? "").replace(/\D/g, "")) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email ?? ""),
    () => !!f.template, () => true, () => true,
    () => f.domainType === "sub" || /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(f.domain ?? ""), () => true,
  ]
  const logo = (file?: File) => { if (!file) return; const r = new FileReader(); r.onload = () => set("logo", r.result); r.readAsDataURL(file) }
  const create = async () => {
    setBusy(true); setErr(null)
    const r = await fetch("/api/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
    const b = await r.json().catch(() => ({}))
    if (r.ok) location.href = `/jobs/${b.jobId}`; else { setErr(b.error ?? "تعذّر الإنشاء"); setBusy(false) }
  }
  const domain = f.domainType === "sub" ? `${f.slug ?? "…"}.${platformDomain}` : f.domain

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 820 }}>
      <ol className="steps" aria-label="الخطوات">{STEPS.map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>{i + 1}. {s}</li>)}</ol>
      <div className="card grid" style={{ gap: 14 }}>
        {step === 0 && <>
          <label>اسم المتجر<input data-testid="w-name" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></label>
          <label>الرمز اللاتيني (يُقترح تلقائياً)<input data-testid="w-slug" dir="ltr" value={f.slug ?? ""} onChange={(e) => setF((x) => ({ ...x, slug: e.target.value.toLowerCase(), slugTouched: true }))} /></label>
          {slugMsg ? <div className="err" data-testid="w-slug-msg">{slugMsg}</div> : f.slug && <div className="ok" data-testid="w-slug-msg">الرمز متاح</div>}
          <label>جوال العميل (مع رمز الدولة)<input data-testid="w-phone" dir="ltr" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="96890000000" /></label>
          <label>بريد العميل (حساب لوحته)<input data-testid="w-email" dir="ltr" type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></label>
        </>}
        {step === 1 && <div className="grid g3">{templates.map((t) => (
          <button key={t.id} type="button" data-testid={`w-tpl-${t.id}`} className={`card pick ${f.template === t.id ? "on" : ""}`} onClick={() => set("template", t.id)}>
            <b>{t.name}</b><span className="muted">{t.description}</span><span className="muted">{t.products} منتجاً · {t.categories} أقسام</span>
          </button>))}</div>}
        {step === 2 && <>
          <div><b>لوحة الألوان</b> <span className="muted">(اتركها لهوية القالب)</span></div>
          <div className="grid g4">{palettes.map((p) => (
            <button key={p.slug} type="button" data-testid={`w-pal-${p.slug}`} className={`card pick ${f.palette === p.slug ? "on" : ""}`} onClick={() => set("palette", f.palette === p.slug ? undefined : p.slug)}>
              <span className="sw">{["bg", "accent", "copper", "hero"].map((k) => <i key={k} style={{ background: p.light[k] }} />)}</span><b>{p.name}</b>
            </button>))}</div>
          <div><b>الخطوط</b></div>
          <div className="grid g3">{fonts.map((x) => (
            <button key={x.slug} type="button" data-testid={`w-font-${x.slug}`} className={`card pick ${f.font === x.slug ? "on" : ""}`} onClick={() => set("font", f.font === x.slug ? undefined : x.slug)}><b>{x.name}</b><span className="muted" dir="ltr">{x.display} + {x.body}</span></button>))}</div>
          <label>الشعار (PNG حتى 2MB، اختياري)<input data-testid="w-logo" type="file" accept="image/png" onChange={(e) => logo(e.target.files?.[0])} /></label>
          {/* eslint-disable-next-line @next/next/no-img-element -- معاينة محلية (data URL) */}
          {f.logo && <img src={f.logo} alt="" style={{ maxHeight: 64, maxWidth: 200 }} />}
        </>}
        {step === 3 && <>
          <div className="grid g3">{FEATURES.map(([k, label]) => (
            <label key={k} className="check"><input type="checkbox" data-testid={`w-f-${k}`} checked={!!f.features[k]} onChange={(e) => set("features", { ...f.features, [k]: e.target.checked })} />{label}</label>))}</div>
          <div><b>المخاطبة</b></div>
          <div className="grid g3">{[["f", "للنساء"], ["m", "للرجال"], ["neutral", "محايدة"]].map(([v, t]) => (
            <label key={v} className="check"><input type="radio" name="voice" data-testid={`w-voice-${v}`} checked={f.voice === v} onChange={() => set("voice", v)} />{t}</label>))}</div>
        </>}
        {step === 4 && <>
          <label className="check"><input type="radio" name="dt" checked={f.domainType === "sub"} onChange={() => set("domainType", "sub")} />نطاق فرعي من المنصة: <bdi dir="ltr">{f.slug}.{platformDomain}</bdi></label>
          <label className="check"><input type="radio" name="dt" data-testid="w-domain-custom" checked={f.domainType === "custom"} onChange={() => set("domainType", "custom")} />دومين العميل</label>
          {f.domainType === "custom" && <>
            <input dir="ltr" data-testid="w-domain" placeholder="shop.example.com" value={f.domain ?? ""} onChange={(e) => set("domain", e.target.value.toLowerCase())} />
            <div className="muted">في لوحة DNS للعميل: سجل <b>A</b> للدومين يشير إلى عنوان خادم المنصة، وسجل <b>A</b> لـ <bdi dir="ltr">api.{f.domain || "…"}</bdi> بنفس العنوان. الشهادة تُصدر تلقائياً بعد انتشار السجل.</div>
            <button type="button" className="btn ghost" onClick={async () => { const d = await (await fetch(`/api/domain?domain=${encodeURIComponent(f.domain ?? "")}`)).json(); setDns(d.ok ? `✔ يشير إلى ${d.expected}` : `لم يُعثر على السجل الصحيح (الحالي: ${d.addrs?.join("، ") || "لا شيء"}؛ المطلوب: ${d.expected})`) }}>تحقق من DNS</button>
            {dns && <div className="muted" data-testid="w-dns">{dns}</div>}
          </>}
        </>}
        {step === 5 && <table data-testid="w-review"><tbody>
          {[["الاسم", f.name], ["الرمز", f.slug], ["الجوال", f.phone], ["البريد", f.email], ["القالب", templates.find((t) => t.id === f.template)?.name],
            ["اللوحة", palettes.find((p) => p.slug === f.palette)?.name ?? "هوية القالب"], ["الخطوط", fonts.find((x) => x.slug === f.font)?.name ?? "خطوط القالب"],
            ["الشعار", f.logo ? "مرفوع" : "شعار القالب"], ["المخاطبة", { f: "للنساء", m: "للرجال", neutral: "محايدة" }[f.voice as string]],
            ["الميزات", FEATURES.filter(([k]) => f.features[k]).map(([, l]) => l).join("، ")], ["الدومين", domain]].map(([k, v]) => <tr key={k}><th>{k}</th><td><bdi>{v}</bdi></td></tr>)}
        </tbody></table>}
        {err && <div className="err" role="alert" data-testid="w-err">{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>السابق</button>}
          {step < 5 ? <button type="button" className="btn" data-testid="w-next" disabled={!valid[step]()} onClick={() => setStep(step + 1)}>التالي</button>
            : <button type="button" className="btn" data-testid="w-create" disabled={busy} onClick={create}>إنشاء المتجر</button>}
        </div>
      </div>
    </div>
  )
}
