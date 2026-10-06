import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Tabs, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

/**
 * «إعدادات المتجر»: العميل يعدّل متجره بنفسه. كل تبويب يحفظ مفاتيحه المتغيّرة فقط إلى
 * /admin/naqla/store-settings (قائمة بيضاء + تحقق على الخادم)، والتغيير يظهر في المتجر خلال ثوانٍ.
 */
type Val = string | number | boolean | null
type Field = {
  key: string
  label: string
  type: "switch" | "text" | "number" | "select" | "voice" | "palette" | "font" | "image"
  hint?: string
  options?: { value: string; label: string }[]
  requires?: string
  placeholder?: string
  dir?: "ltr" | "rtl"
}
type Palette = { slug: string; name: string; use?: string; radius: Record<string, number>; light: Record<string, string>; dark: Record<string, string> }
type FontPair = { slug: string; name: string; display: string; body: string; latin?: string }
type Data = {
  presets: { palettes: Palette[]; fonts: FontPair[] }
  values: Record<string, Val>
  defaults: Record<string, Val>
  governorates: { code: string; name: string; wilayats?: string[] }[]
  history: { at: string; by: string; changes: { key: string; from: unknown; to: unknown }[] }[]
}

const FEATURES: Field[] = [
  { key: "features.cod", label: "الدفع عند الاستلام", type: "switch" },
  { key: "features.thawani", label: "الدفع الإلكتروني (ثواني)", type: "switch", hint: "يتطلب مفاتيح ثواني في تبويب الدفع والتواصل" },
  { key: "features.whatsappOrder", label: "إرسال الطلب عبر واتساب", type: "switch" },
  { key: "features.expressDelivery", label: "التوصيل السريع", type: "switch" },
  { key: "features.pickup", label: "الاستلام من المحل", type: "switch" },
  { key: "features.loyalty", label: "نقاط الولاء", type: "switch" },
  { key: "features.loyaltyTiers", label: "مستويات الولاء (ذهبية، ماسية…)", type: "switch", requires: "features.loyalty" },
  { key: "features.gift", label: "إرسال الطلب هدية", type: "switch" },
  { key: "features.tailoring", label: "التفصيل الخاص", type: "switch" },
  { key: "features.sizeGuide", label: "دليل المقاسات", type: "switch" },
  { key: "features.lengthField", label: "حقل الطول", type: "switch" },
  { key: "features.reviews", label: "التقييمات", type: "switch", hint: "اتركها مطفأة حتى يتوفر نظام تقييمات حقيقي" },
  { key: "features.bnpl", label: "الدفع بالتقسيط", type: "switch", hint: "لا يظهر إلا إن دعم المزوّد عملة المتجر" },
]
const VOICE: Field[] = [{ key: "voice", label: "مخاطبة الزبائن", type: "voice" }]
const STORE: Field[] = [
  { key: "contact.phone", label: "هاتف المتجر", type: "text", dir: "ltr", placeholder: "+96890000000" },
  { key: "contact.whatsapp", label: "رقم واتساب المتجر", type: "text", dir: "ltr", placeholder: "96890000000" },
  { key: "contact.email", label: "البريد الإلكتروني", type: "text", dir: "ltr" },
  { key: "contact.address", label: "العنوان", type: "text" },
  { key: "contact.hours", label: "ساعات العمل", type: "text" },
  { key: "social.instagram", label: "إنستغرام", type: "text", dir: "ltr", placeholder: "https://instagram.com/…" },
  { key: "social.snapchat", label: "سناب شات", type: "text", dir: "ltr" },
  { key: "social.tiktok", label: "تيك توك", type: "text", dir: "ltr" },
  { key: "social.x", label: "X", type: "text", dir: "ltr" },
  { key: "location.name", label: "اسم موقع الاستلام", type: "text" },
  { key: "location.address", label: "عنوان موقع الاستلام", type: "text" },
  { key: "location.province", label: "محافظة موقع الاستلام", type: "select" },
  { key: "location.wilayat", label: "ولاية موقع الاستلام", type: "select" },
  { key: "legal.cr", label: "السجل التجاري", type: "text", dir: "ltr", hint: "يظهر في الفوتر وصفحات السياسات" },
  { key: "legal.vat", label: "الرقم الضريبي", type: "text", dir: "ltr", placeholder: "OM1234567890" },
  { key: "returnDays", label: "مدة الإرجاع (أيام)", type: "number" },
  { key: "reservationHours.whatsapp", label: "حجز مخزون طلبات واتساب (ساعات)", type: "number", hint: "يُلغى الطلب غير المؤكد بعدها ويُفك الحجز" },
  { key: "reservationHours.pickup", label: "حجز مخزون طلبات الاستلام (ساعات)", type: "number" },
]
const IDENTITY: Field[] = [
  { key: "name", label: "اسم المتجر", type: "text" },
  { key: "shortName", label: "الاسم المختصر", type: "text", hint: "يظهر على الجوال وأيقونة التطبيق" },
  { key: "tagline", label: "الشعار النصي", type: "text" },
  { key: "description", label: "وصف المتجر", type: "text", hint: "لمحركات البحث ومشاركة الروابط" },
  { key: "brand.logo", label: "الشعار", type: "image", hint: "PNG أو JPEG أو WebP حتى 5MB — يُصغَّر تلقائياً" },
  { key: "brand.wordmark", label: "الشعار يحوي اسم المتجر كاملاً", type: "switch", hint: "مطفأ: علامة مربعة يجاورها الاسم المختصر" },
  { key: "icons.icon512", label: "أيقونة المتجر", type: "image", hint: "مربعة 192×192 على الأقل — تُولَّد منها أيقونات الجوال والمتصفح" },
  { key: "theme.palette", label: "لوحة الألوان", type: "palette" },
  { key: "theme.font", label: "الخطوط", type: "font" },
]
// أسماء عائلات Google لمعاينة الخطوط في اللوحة
const FAMILY = (slug: string) => slug === "ibm-plex-sans-arabic" ? "IBM Plex Sans Arabic" : slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
const TABS: { id: string; title: string; fields?: Field[]; soon?: string }[] = [
  { id: "identity", title: "الهوية", fields: IDENTITY },
  { id: "features", title: "الميزات", fields: FEATURES },
  { id: "voice", title: "المخاطبة", fields: VOICE },
  { id: "shipping", title: "التوصيل", soon: "المحافظات والأسعار وحد المجاني — قيد الإضافة" },
  { id: "payments", title: "الدفع والتواصل", soon: "مفاتيح ثواني وواتساب — قيد الإضافة" },
  { id: "store", title: "بيانات المتجر", fields: STORE },
]
const VOICE_SAMPLE: Record<string, string> = { f: "أضيفي للسلة · أدخلي رقمك", m: "أضف للسلة · أدخل رقمك", neutral: "إضافة إلى السلة · رقم الهاتف" }

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? "تعذّر الحفظ")
  return body
}

const StoreSettingsPage = () => {
  const [data, setData] = useState<Data | null>(null)
  const [draft, setDraft] = useState<Record<string, Val>>({})
  const [msg, setMsg] = useState<{ tab: string; ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const load = () => api("/admin/naqla/store-settings").then((d: Data) => { setData(d); setDraft(d.values) })
  useEffect(() => { load() }, [])

  const wilayats = useMemo(() => data?.governorates.find((g) => g.code === draft["location.province"])?.wilayats ?? [], [data, draft])
  const set = (k: string, v: Val) => setDraft((d) => ({ ...d, [k]: v }))

  const save = async (tab: string, fields: Field[]) => {
    if (!data) return
    const values = Object.fromEntries(fields.filter((f) => f.type !== "image").map((f) => f.key).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(data.values[k])).map((k) => [k, draft[k]]))
    if (!Object.keys(values).length) return setMsg({ tab, ok: true, text: "لا تغييرات للحفظ" })
    setSaving(tab)
    try {
      const r = await api("/admin/naqla/store-settings", { method: "POST", body: JSON.stringify({ values }) })
      setMsg({ tab, ok: true, text: `تم الحفظ (${r.changes.length}) — يظهر في المتجر خلال ثوانٍ` })
      await load()
    } catch (e) {
      setMsg({ tab, ok: false, text: (e as Error).message })
    } finally {
      setSaving(null)
    }
  }

  const field = (f: Field) => {
    const v = draft[f.key]
    const changed = data && JSON.stringify(v) !== JSON.stringify(data.defaults[f.key])
    const disabled = !!f.requires && draft[f.requires] !== true
    const label = (
      <div className="flex items-center gap-2">
        <Label htmlFor={f.key}>{f.label}</Label>
        {changed && <Badge size="2xsmall" color="blue">معدّل</Badge>}
      </div>
    )
    if (f.type === "switch")
      return (
        <div key={f.key} className="flex items-center justify-between gap-4 py-2">
          <div>{label}{(f.hint || disabled) && <Text size="xsmall" className="text-ui-fg-subtle">{disabled ? "يتطلب تفعيل الولاء أولاً" : f.hint}</Text>}</div>
          <Switch id={f.key} data-testid={`set-${f.key}`} checked={v === true} disabled={disabled} onCheckedChange={(c) => set(f.key, c)} />
        </div>
      )
    if (f.type === "voice")
      return (
        <div key={f.key} className="grid gap-2 py-2" role="radiogroup" aria-label={f.label}>
          {label}
          {[["f", "للنساء"], ["m", "للرجال"], ["neutral", "محايدة"]].map(([val, t]) => (
            <label key={val} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3" data-testid={`voice-${val}`}>
              <input type="radio" name="voice" checked={v === val} onChange={() => set("voice", val)} />
              <span className="font-medium">{t}</span>
              <Text size="xsmall" className="text-ui-fg-subtle">مثال: {VOICE_SAMPLE[val]}</Text>
            </label>
          ))}
        </div>
      )
    if (f.type === "image") {
      const kind = f.key === "brand.logo" ? "logo" : "icon"
      const url = typeof v === "string" && /^https?:/.test(v) ? v : null
      const upload = (file?: File) => {
        if (!file) return
        const r = new FileReader()
        r.onload = async () => {
          setSaving("identity")
          try {
            const bg = data?.presets.palettes.find((p) => p.slug === draft["theme.palette"])?.light.bg ?? "#ffffff"
            const out = await api("/admin/naqla/store-settings/brand", { method: "POST", body: JSON.stringify({ kind, data: r.result, background: bg }) })
            setMsg({ tab: "identity", ok: true, text: `تم رفع ${kind === "logo" ? "الشعار" : "الأيقونة"} (${out.changes.length}) — يظهر في المتجر خلال ثوانٍ` })
            await load()
          } catch (e) {
            setMsg({ tab: "identity", ok: false, text: (e as Error).message })
          } finally {
            setSaving(null)
          }
        }
        r.readAsDataURL(file)
      }
      const reset = async () => {
        const keys = kind === "logo" ? ["brand.logo"] : ["icons.icon192", "icons.icon512", "icons.maskable", "icons.apple", "icons.svg"]
        try {
          await api("/admin/naqla/store-settings", { method: "POST", body: JSON.stringify({ values: Object.fromEntries(keys.map((k) => [k, data!.defaults[k]])) }) })
          setMsg({ tab: "identity", ok: true, text: "أُعيدت الصورة الافتراضية" }); await load()
        } catch (e) { setMsg({ tab: "identity", ok: false, text: (e as Error).message }) }
      }
      return (
        <div key={f.key} className="flex items-center gap-4 py-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-ui-bg-subtle">
            {url ? <img src={url} alt="" className="max-h-full max-w-full" data-testid={`img-${kind}`} /> : <Text size="xsmall" className="text-ui-fg-subtle">افتراضي</Text>}
          </div>
          <div className="grid gap-1">
            {label}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/png,image/jpeg,image/webp" data-testid={`upload-${kind}`} onChange={(e) => upload(e.target.files?.[0])} />
              {url && <Button size="small" variant="secondary" onClick={reset} data-testid={`reset-${kind}`}>الافتراضي</Button>}
            </div>
            {f.hint && <Text size="xsmall" className="text-ui-fg-subtle">{f.hint}</Text>}
          </div>
        </div>
      )
    }
    if (f.type === "palette") {
      const custom = data?.defaults["theme.palette"] === "custom"
      const opts = [...(custom ? [{ slug: "custom", name: "هوية مخصصة", use: "هوية المتجر من نقلة", light: {} as Record<string, string> }] : []), ...(data?.presets.palettes ?? [])]
      return (
        <div key={f.key} className="grid gap-2 py-2">
          {label}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="radiogroup" aria-label={f.label}>
            {opts.map((p) => (
              <button key={p.slug} type="button" role="radio" aria-checked={v === p.slug} data-testid={`palette-${p.slug}`} onClick={() => set(f.key, p.slug)}
                className={`rounded-lg border p-2 text-start ${v === p.slug ? "border-ui-fg-interactive ring-1 ring-ui-fg-interactive" : ""}`}>
                <div className="mb-1 flex h-6 overflow-hidden rounded">
                  {p.slug === "custom" ? <div className="flex-1 bg-ui-bg-subtle" /> : ["bg", "accent", "copper", "hero", "ink"].map((k) => <div key={k} className="flex-1" style={{ background: (p as Palette).light[k] }} />)}
                </div>
                <div className="text-xs font-medium">{p.name}</div>
                <div className="text-[11px] text-ui-fg-subtle">{p.use}</div>
              </button>
            ))}
          </div>
        </div>
      )
    }
    if (f.type === "font") {
      const custom = data?.defaults["theme.font"] === "custom"
      const opts = [...(custom ? [{ slug: "custom", name: "خطوط مخصصة", display: "", body: "" }] : []), ...(data?.presets.fonts ?? [])]
      return (
        <div key={f.key} className="grid gap-2 py-2">
          {label}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3" role="radiogroup" aria-label={f.label}>
            {opts.map((x) => (
              <button key={x.slug} type="button" role="radio" aria-checked={v === x.slug} data-testid={`font-${x.slug}`} onClick={() => set(f.key, x.slug)}
                className={`rounded-lg border p-3 text-start ${v === x.slug ? "border-ui-fg-interactive ring-1 ring-ui-fg-interactive" : ""}`}>
                <div style={{ fontFamily: x.display ? `"${FAMILY(x.display)}"` : undefined, fontSize: 18, fontWeight: 700 }}>عباءة مطرزة</div>
                <div style={{ fontFamily: x.body ? `"${FAMILY(x.body)}"` : undefined, fontSize: 13 }}>{x.name} — توصيل لكل المحافظات</div>
              </button>
            ))}
          </div>
        </div>
      )
    }
    if (f.type === "select") {
      const opts = f.key === "location.province" ? (data?.governorates ?? []).map((g) => ({ value: g.code, label: g.name })) : wilayats.map((w) => ({ value: w, label: w }))
      return (
        <div key={f.key} className="grid gap-1 py-2">
          {label}
          <Select value={(v as string) ?? ""} onValueChange={(x) => { set(f.key, x); if (f.key === "location.province") set("location.wilayat", null) }}>
            <Select.Trigger data-testid={`set-${f.key}`}><Select.Value placeholder="اختر" /></Select.Trigger>
            <Select.Content>{opts.map((o) => <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>)}</Select.Content>
          </Select>
        </div>
      )
    }
    return (
      <div key={f.key} className="grid gap-1 py-2">
        {label}
        <Input id={f.key} data-testid={`set-${f.key}`} dir={f.dir} type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder} value={v == null ? "" : String(v)}
          onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />
        {f.hint && <Text size="xsmall" className="text-ui-fg-subtle">{f.hint}</Text>}
      </div>
    )
  }

  // معاينة حية للهوية قبل الحفظ (اللوحة والخط والاسم من المسودة)
  const preview = (() => {
    if (!data) return null
    const pal = data.presets.palettes.find((p) => p.slug === draft["theme.palette"])
    const font = data.presets.fonts.find((x) => x.slug === draft["theme.font"])
    const card = (mode: "light" | "dark") => {
      const c = pal?.[mode]
      if (!c) return <div key={mode} className="rounded-lg border p-4 text-ui-fg-subtle">الهوية المخصصة تبقى كما صمّمتها نقلة</div>
      return (
        <div key={mode} data-testid={`preview-${mode}`} style={{ background: c.bg, color: c.ink, borderRadius: pal!.radius.lg, padding: 14, fontFamily: font ? `"${FAMILY(font.body)}"` : undefined }}>
          <div style={{ fontFamily: font ? `"${FAMILY(font.display)}"` : undefined, fontWeight: 700, fontSize: 18, color: c.accent }}>{String(draft.name ?? "")}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{String(draft.tagline ?? "")}</div>
          <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: pal!.radius.md, padding: 10, marginTop: 10 }}>
            <div style={{ fontWeight: 600 }}>عباءة مطرزة بحواف ذهبية</div>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
              <bdi style={{ color: c.accent, fontWeight: 700 }}>24.500 ر.ع</bdi>
              <s style={{ color: c.muted, fontSize: 12 }}><bdi>29.000</bdi></s>
              <bdi dir="ltr" style={{ background: c.copper, color: c["copper-ink"], borderRadius: pal!.radius.sm, fontSize: 11, padding: "1px 6px" }}>-16%</bdi>
            </div>
            <div style={{ background: c.accent, color: c["accent-ink"], borderRadius: pal!.radius.sm, textAlign: "center", padding: 8, marginTop: 8, fontWeight: 600 }}>أضف إلى السلة</div>
          </div>
          <div style={{ background: c.footer, color: c["footer-ink"], borderRadius: pal!.radius.sm, padding: 8, marginTop: 10, fontSize: 11 }}>© {String(draft.name ?? "")}</div>
        </div>
      )
    }
    return <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="identity-preview">{card("light")}{card("dark")}</div>
  })()
  const fontsHref = data ? `https://fonts.googleapis.com/css2?${[...new Set(data.presets.fonts.flatMap((x) => [x.display, x.body, x.latin]).filter((x): x is string => !!x && x !== "none"))].map((x) => `family=${FAMILY(x).replace(/ /g, "+")}:wght@400;700`).join("&")}&display=swap` : ""

  if (!data) return <Container><Text>جارٍ التحميل…</Text></Container>
  return (
    <div className="flex flex-col gap-y-3" dir="rtl">
      <Container className="p-0">
        <div className="px-6 py-4"><Heading>إعدادات المتجر</Heading><Text size="small" className="text-ui-fg-subtle">ما تحفظه هنا يظهر في متجرك خلال ثوانٍ، والقيمة المطابقة للافتراضي تعيده كما كان.</Text></div>
        <Tabs defaultValue="features" className="px-6 pb-6">
          <Tabs.List>{TABS.map((t) => <Tabs.Trigger key={t.id} value={t.id} data-testid={`tab-${t.id}`}>{t.title}</Tabs.Trigger>)}</Tabs.List>
          {TABS.map((t) => (
            <Tabs.Content key={t.id} value={t.id} className="pt-4">
              {t.soon ? <Text className="text-ui-fg-subtle">{t.soon}</Text> : (
                <div className={`${t.id === "identity" ? "max-w-4xl" : "max-w-2xl"} divide-y`}>
                  {t.id === "identity" && <><link rel="stylesheet" href={fontsHref} /><div className="pb-4"><Text size="small" weight="plus" className="mb-2">معاينة قبل الحفظ</Text>{preview}</div></>}
                  {t.fields!.map(field)}
                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={() => save(t.id, t.fields!)} isLoading={saving === t.id} data-testid={`save-${t.id}`}>حفظ</Button>
                    {msg?.tab === t.id && <Text size="small" data-testid="settings-msg" className={msg.ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{msg.text}</Text>}
                  </div>
                </div>
              )}
            </Tabs.Content>
          ))}
        </Tabs>
      </Container>
      <Container>
        <Heading level="h2">سجل التغييرات</Heading>
        <div className="mt-3 grid gap-2" data-testid="settings-history">
          {data.history.length ? data.history.map((h, i) => (
            <Text key={i} size="small"><b>{new Date(h.at).toLocaleString("ar-OM-u-nu-latn")}</b> — {h.by ?? "—"}: {h.changes.map((c) => `${c.key}: ${JSON.stringify(c.from)} ← ${JSON.stringify(c.to)}`).join("، ")}</Text>
          )) : <Text size="small" className="text-ui-fg-subtle">لا تغييرات بعد</Text>}
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "إعدادات المتجر", icon: BuildingStorefront, rank: 0 })
export default StoreSettingsPage
