import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Tabs, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { Data, type Lang, naqlaApi, useNaqlaT } from "../../lib/naqla-i18n"

/**
 * «إعدادات المتجر»: العميل يعدّل متجره بنفسه. كل تبويب يحفظ مفاتيحه المتغيّرة فقط إلى
 * /admin/naqla/store-settings (قائمة بيضاء + تحقق على الخادم)، والتغيير يظهر في المتجر خلال ثوانٍ.
 */
type Val = string | number | boolean | null | string[]
// التسمية من naqla.fields.<key> والتلميح (hint: true) من naqla.hints.<key> — النقاط في المفتاح تصبح _
type Field = {
  key: string
  type: "switch" | "text" | "number" | "select" | "voice" | "palette" | "font" | "image" | "langs"
  hint?: true
  options?: string[]
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
  governorates: { code: string; name: string; wilayats?: string[]; wilayatLabels?: string[] }[]
  history: { at: string; by: string; changes: { key: string; from: unknown; to: unknown }[] }[]
}

const FEATURES: Field[] = [
  { key: "languages", type: "langs", hint: true },
  { key: "defaultLanguage", type: "select", options: ["ar", "en"], hint: true },
  { key: "features.cod", type: "switch" },
  { key: "features.thawani", type: "switch", hint: true },
  { key: "features.whatsappOrder", type: "switch" },
  { key: "features.expressDelivery", type: "switch" },
  { key: "features.pickup", type: "switch" },
  { key: "features.loyalty", type: "switch" },
  { key: "features.loyaltyTiers", type: "switch", requires: "features.loyalty" },
  { key: "features.gift", type: "switch" },
  { key: "features.tailoring", type: "switch" },
  { key: "features.sizeGuide", type: "switch" },
  { key: "features.lengthField", type: "switch" },
  { key: "features.reviews", type: "switch", hint: true },
  { key: "features.bnpl", type: "switch", hint: true },
]
const VOICE: Field[] = [{ key: "voice", type: "voice" }]
const STORE: Field[] = [
  { key: "contact.phone", type: "text", dir: "ltr", placeholder: "+96890000000" },
  { key: "contact.whatsapp", type: "text", dir: "ltr", placeholder: "96890000000" },
  { key: "contact.email", type: "text", dir: "ltr" },
  { key: "contact.address", type: "text" },
  { key: "contact.hours", type: "text" },
  { key: "social.instagram", type: "text", dir: "ltr", placeholder: "https://instagram.com/…" },
  { key: "social.snapchat", type: "text", dir: "ltr" },
  { key: "social.tiktok", type: "text", dir: "ltr" },
  { key: "social.x", type: "text", dir: "ltr" },
  { key: "location.name", type: "text" },
  { key: "location.address", type: "text" },
  { key: "location.province", type: "select" },
  { key: "location.wilayat", type: "select" },
  { key: "legal.cr", type: "text", dir: "ltr", hint: true },
  { key: "legal.vat", type: "text", dir: "ltr", placeholder: "OM1234567890" },
  { key: "returnDays", type: "number" },
  { key: "reservationHours.whatsapp", type: "number", hint: true },
  { key: "reservationHours.pickup", type: "number" },
]
const IDENTITY: Field[] = [
  { key: "name", type: "text" },
  { key: "shortName", type: "text", hint: true },
  { key: "tagline", type: "text" },
  { key: "description", type: "text", hint: true },
  { key: "brand.logo", type: "image", hint: true },
  { key: "brand.wordmark", type: "switch", hint: true },
  { key: "icons.icon512", type: "image", hint: true },
  { key: "theme.palette", type: "palette" },
  { key: "theme.font", type: "font" },
]
// أسماء عائلات Google لمعاينة الخطوط في اللوحة
const FAMILY = (slug: string) => slug === "ibm-plex-sans-arabic" ? "IBM Plex Sans Arabic" : slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
// عنوان التبويب من naqla.settings.tabs.<id>
const TABS: { id: string; fields?: Field[] }[] = [
  { id: "identity", fields: IDENTITY },
  { id: "features", fields: FEATURES },
  { id: "voice", fields: VOICE },
  { id: "shipping" },
  { id: "payments" },
  { id: "store", fields: STORE },
]
// المخاطبة تخص الواجهة العربية فقط (الإنجليزية بلا تأنيث): أمثلتها نص المتجر العربي كما تراه الزبونة — عيّنة لا نص لوحة
const VOICE_SAMPLE: Record<string, string> = { f: "أضيفي للسلة · أدخلي رقمك", m: "أضف للسلة · أدخل رقمك", neutral: "إضافة إلى السلة · رقم الهاتف" } // i18n-ok
const fieldKey = (k: string) => k.replace(/\./g, "_")

/** نداء مسارات الإعدادات بلغة اللوحة؛ الخطأ يحمل رسالة الخادم (رمزاً تترجمه errorText) */
const useApi = () => {
  const { lang } = useNaqlaT()
  return (path: string, init?: RequestInit) => naqlaApi(path, lang as Lang, init)
}

/** تبويب «التوصيل»: يقرأ ويكتب خيارات شحن Medusa مباشرة (مصدر واحد) */
type Ship = {
  standard: { amount: number | null; free_over: number | null } | null
  express: { amount: number | null; provinces: string[] | null } | null
  governorates: string[] | null
  cutoffHour: number | null
  deliveryOffDays: number[]
  all: { code: string; name: string }[]
  pickupProvince: string | null
}
const DAYS = [0, 1, 2, 3, 4, 5, 6] // naqla.settings.days.<0–6>: الأحد…السبت
const ShippingTab = ({ onSaved }: { onSaved: () => void }) => {
  const { t, lang, errorText } = useNaqlaT()
  const api = useApi()
  const [d, setD] = useState<Ship | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => api("/admin/naqla/store-settings/shipping").then((x: Ship) => setD({ ...x, governorates: x.governorates ?? x.all.map((g) => g.code) }))
  useEffect(() => { load() }, [lang])
  if (!d) return <Text>{t("common.loading")}</Text>
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const save = async () => {
    setBusy(true)
    try {
      const r = await api("/admin/naqla/store-settings/shipping", {
        method: "POST",
        body: JSON.stringify({
          standard: d.standard ? { amount: d.standard.amount, free_over: d.standard.free_over } : undefined,
          express: d.express ? { amount: d.express.amount, provinces: d.express.provinces ?? [] } : undefined,
          governorates: d.governorates,
          cutoffHour: d.cutoffHour,
          deliveryOffDays: d.deliveryOffDays,
        }),
      })
      setMsg({ ok: true, text: r.changes.length ? t("settings.savedLive", { n: r.changes.length }) : t("settings.noChanges") })
      await load(); onSaved()
    } catch (e) {
      setMsg({ ok: false, text: errorText((e as Error).message) })
    } finally {
      setBusy(false)
    }
  }
  const num = (v: string) => (v === "" ? null : Number(v))
  return (
    <div className="grid max-w-3xl gap-5">
      {d.standard && (
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("fields.shipping_standard_amount")}</Label><Input data-testid="ship-standard-amount" type="number" step="0.001" value={d.standard.amount ?? ""} onChange={(e) => setD({ ...d, standard: { ...d.standard!, amount: num(e.target.value) } })} /></div>
          <div><Label>{t("settings.freeOver")}</Label><Input data-testid="ship-free-over" type="number" step="0.001" placeholder={t("settings.noFreeShipping")} value={d.standard.free_over ?? ""} onChange={(e) => setD({ ...d, standard: { ...d.standard!, free_over: num(e.target.value) } })} /></div>
        </div>
      )}
      {d.express && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("fields.shipping_express_amount")}</Label><Input data-testid="ship-express-amount" type="number" step="0.001" value={d.express.amount ?? ""} onChange={(e) => setD({ ...d, express: { ...d.express!, amount: num(e.target.value) } })} /></div>
            <div><Label>{t("settings.cutoff")}</Label>
              <Select value={String(d.cutoffHour ?? 15)} onValueChange={(v) => setD({ ...d, cutoffHour: Number(v) })}>
                <Select.Trigger data-testid="ship-cutoff"><Select.Value /></Select.Trigger>
                <Select.Content>{Array.from({ length: 16 }, (_, i) => i + 8).map((h) => <Select.Item key={h} value={String(h)}>{h}:00</Select.Item>)}</Select.Content>
              </Select>
            </div>
          </div>
          <Label>{t("fields.shipping_express_provinces")}</Label>
          <div className="flex flex-wrap gap-2">{d.all.map((g) => (
            <label key={g.code} className="flex items-center gap-1 rounded border px-2 py-1 text-sm" data-testid={`express-${g.code}`}>
              <input type="checkbox" checked={(d.express!.provinces ?? []).includes(g.code)} onChange={() => setD({ ...d, express: { ...d.express!, provinces: toggle(d.express!.provinces ?? [], g.code) } })} /><Data>{g.name}</Data>
            </label>))}</div>
        </div>
      )}
      <div className="grid gap-2">
        <Label>{t("settings.governorates")}</Label>
        <div className="flex flex-wrap gap-2">{d.all.map((g) => {
          const locked = g.code === d.pickupProvince
          return (
            <label key={g.code} className="flex items-center gap-1 rounded border px-2 py-1 text-sm" data-testid={`gov-${g.code}`} title={locked ? t("settings.pickupLocked") : ""}>
              <input type="checkbox" disabled={locked} checked={locked || (d.governorates ?? []).includes(g.code)} onChange={() => setD({ ...d, governorates: toggle(d.governorates ?? [], g.code) })} /><Data>{g.name}</Data>
            </label>)
        })}</div>
      </div>
      <div className="grid gap-2">
        <Label>{t("settings.offDays")}</Label>
        <div className="flex flex-wrap gap-2">{DAYS.map((i) => (
          <label key={i} className="flex items-center gap-1 rounded border px-2 py-1 text-sm" data-testid={`offday-${i}`}>
            <input type="checkbox" checked={d.deliveryOffDays.includes(i)} onChange={() => setD({ ...d, deliveryOffDays: d.deliveryOffDays.includes(i) ? d.deliveryOffDays.filter((x) => x !== i) : [...d.deliveryOffDays, i].sort() })} />{t(`settings.days.${i}`)}
          </label>))}</div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} isLoading={busy} data-testid="save-shipping">{t("common.save")}</Button>
        {msg && <Text size="small" data-testid="settings-msg" className={msg.ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{msg.text}</Text>}
      </div>
    </div>
  )
}

/** تبويب «الدفع والتواصل»: أسرار مشفّرة تظهر مخفية بعد الحفظ، مع زر اختبار لكل منصة */
type Sec = Record<string, { value: string | null; source: "settings" | "env" | null }>
// التسمية من naqla.fields.<key> (thawani_secretKey…) ومصدر القيمة من naqla.settings.source.<settings|env>
const SECRET_FIELDS: { key: string; group: "thawani" | "whatsapp" }[] = [
  { key: "thawani.secretKey", group: "thawani" },
  { key: "thawani.publishableKey", group: "thawani" },
  { key: "whatsapp.accessToken", group: "whatsapp" },
  { key: "whatsapp.phoneNumberId", group: "whatsapp" },
  { key: "whatsapp.businessAccountId", group: "whatsapp" },
]
const PaymentsTab = ({ onSaved }: { onSaved: () => void }) => {
  const { t, lang, errorText } = useNaqlaT()
  const api = useApi()
  const [sec, setSec] = useState<Sec | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [phones, setPhones] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [test, setTest] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const load = () => api("/admin/naqla/store-settings/payments").then((d) => { setSec(d.secrets); setPhones((d.merchantPhones ?? []).join(t("common.listSep"))); setDraft({}) })
  useEffect(() => { load() }, [lang])
  if (!sec) return <Text>{t("common.loading")}</Text>
  const save = async (extra: Record<string, string> = {}) => {
    setBusy("save")
    try {
      const secrets = { ...draft, ...extra }
      const r = await api("/admin/naqla/store-settings/payments", { method: "POST", body: JSON.stringify({ secrets, merchantPhones: phones.split(/[،,\s]+/).filter(Boolean) }) })
      setMsg({ ok: true, text: r.changes.length ? t("settings.savedSecrets", { n: r.changes.length }) : t("settings.noChanges") })
      await load(); onSaved()
    } catch (e) { setMsg({ ok: false, text: errorText((e as Error).message) }) } finally { setBusy(null) }
  }
  const runTest = async (platform: string) => {
    setBusy(platform)
    try { const r = await api(`/admin/naqla/store-settings/payments/test/${platform}`, { method: "POST" }); setTest((x) => ({ ...x, [platform]: r })) }
    catch (e) { setTest((x) => ({ ...x, [platform]: { ok: false, message: (e as Error).message } })) } finally { setBusy(null) }
  }
  const group = (g: "thawani" | "whatsapp") => (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between"><Heading level="h3">{t(`settings.groups.${g}`)}</Heading>
        <Button size="small" variant="secondary" onClick={() => runTest(g)} isLoading={busy === g} data-testid={`test-${g}`}>{t("settings.test")}</Button></div>
      {test[g] && <Text size="small" data-testid={`test-${g}-result`} className={test[g].ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{errorText(test[g].message)}</Text>}
      {g === "thawani" && (
        <div className="grid gap-1"><Label>{t("settings.mode")}</Label>
          <Select value={draft["thawani.mode"] ?? sec["thawani.mode"]?.value ?? "uat"} onValueChange={(v) => setDraft({ ...draft, "thawani.mode": v })}>
            <Select.Trigger data-testid="thawani-mode"><Select.Value /></Select.Trigger>
            <Select.Content><Select.Item value="uat">{t("settings.modes.uat")}</Select.Item><Select.Item value="live">{t("settings.modes.live")}</Select.Item></Select.Content>
          </Select></div>
      )}
      {SECRET_FIELDS.filter((f) => f.group === g).map((f) => (
        <div key={f.key} className="grid gap-1">
          <div className="flex items-center gap-2"><Label>{t(`fields.${fieldKey(f.key)}`)}</Label>{sec[f.key]?.source && <Badge size="2xsmall" color={sec[f.key].source === "settings" ? "green" : "grey"}>{t(`settings.source.${sec[f.key].source}`)}</Badge>}</div>
          <div className="flex gap-2">
            <Input dir="ltr" autoComplete="off" data-testid={`secret-${f.key}`} placeholder={sec[f.key]?.value ?? t("settings.unset")} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            {sec[f.key]?.source === "settings" && <Button size="small" variant="secondary" onClick={() => save({ [f.key]: "" })} data-testid={`delete-${f.key}`}>{t("common.delete")}</Button>}
          </div>
        </div>
      ))}
    </div>
  )
  return (
    <div className="grid max-w-3xl gap-4">
      <Text size="small" className="text-ui-fg-subtle">{t("settings.secretsNote")}</Text>
      {group("thawani")}
      {group("whatsapp")}
      <div className="grid gap-1"><Label>{t("fields.merchantPhones")}</Label>
        <Input dir="ltr" data-testid="merchant-phones" placeholder={["96890000000", "96891111111"].join(t("common.listSep"))} value={phones} onChange={(e) => setPhones(e.target.value)} />
        <Text size="xsmall" className="text-ui-fg-subtle">{t("hints.merchantPhones")}</Text></div>
      <div className="flex items-center gap-3">
        <Button onClick={() => save()} isLoading={busy === "save"} data-testid="save-payments">{t("common.save")}</Button>
        {msg && <Text size="small" data-testid="settings-msg" className={msg.ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{msg.text}</Text>}
      </div>
    </div>
  )
}

const StoreSettingsPage = () => {
  const { t, tOr, lang, errorText, token } = useNaqlaT()
  const api = useApi()
  const [data, setData] = useState<Data | null>(null)
  const [draft, setDraft] = useState<Record<string, Val>>({})
  const [msg, setMsg] = useState<{ tab: string; ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const load = () => api("/admin/naqla/store-settings").then((d: Data) => { setData(d); setDraft(d.values) })
  useEffect(() => { load() }, [lang])

  // الولاية تُحفظ عربية (القيمة) وتُعرض بلغة اللوحة (wilayatLabels بالترتيب نفسه)
  const wilayats = useMemo(() => {
    const g = data?.governorates.find((x) => x.code === draft["location.province"])
    return (g?.wilayats ?? []).map((w, i) => ({ value: w, label: g?.wilayatLabels?.[i] ?? w }))
  }, [data, draft])
  const set = (k: string, v: Val) => setDraft((d) => ({ ...d, [k]: v }))

  const save = async (tab: string, fields: Field[]) => {
    if (!data) return
    const values = Object.fromEntries(fields.filter((f) => f.type !== "image").map((f) => f.key).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(data.values[k])).map((k) => [k, draft[k]]))
    if (!Object.keys(values).length) return setMsg({ tab, ok: true, text: t("settings.noChanges") })
    setSaving(tab)
    try {
      const r = await api("/admin/naqla/store-settings", { method: "POST", body: JSON.stringify({ values }) })
      setMsg({ tab, ok: true, text: t("settings.savedLive", { n: r.changes.length }) })
      await load()
    } catch (e) {
      setMsg({ tab, ok: false, text: errorText((e as Error).message) })
    } finally {
      setSaving(null)
    }
  }

  const field = (f: Field) => {
    const v = draft[f.key]
    const changed = data && JSON.stringify(v) !== JSON.stringify(data.defaults[f.key])
    const disabled = !!f.requires && draft[f.requires] !== true
    const k = fieldKey(f.key)
    const title = t(`fields.${k}`)
    const hint = f.hint ? t(`hints.${k}`) : null
    const label = (
      <div className="flex items-center gap-2">
        <Label htmlFor={f.key}>{title}</Label>
        {changed && <Badge size="2xsmall" color="blue">{t("settings.modified")}</Badge>}
      </div>
    )
    if (f.type === "switch")
      return (
        <div key={f.key} className="flex items-center justify-between gap-4 py-2">
          <div>{label}{(hint || disabled) && <Text size="xsmall" className="text-ui-fg-subtle">{disabled ? t("settings.needsLoyalty") : hint}</Text>}</div>
          <Switch id={f.key} data-testid={`set-${f.key}`} checked={v === true} disabled={disabled} onCheckedChange={(c) => set(f.key, c)} />
        </div>
      )
    if (f.type === "voice")
      return (
        <div key={f.key} className="grid gap-2 py-2" role="radiogroup" aria-label={title}>
          {label}
          {lang !== "ar" && <Text size="xsmall" className="text-ui-fg-subtle">{t("settings.voiceNote")}</Text>}
          {["f", "m", "neutral"].map((val) => (
            <label key={val} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3" data-testid={`voice-${val}`}>
              <input type="radio" name="voice" checked={v === val} onChange={() => set("voice", val)} />
              <span className="font-medium">{t(`settings.voices.${val}`)}</span>
              <Text size="xsmall" className="text-ui-fg-subtle">{t("settings.example")} <bdi lang="ar" dir="rtl">{VOICE_SAMPLE[val]}</bdi></Text>
            </label>
          ))}
        </div>
      )
    if (f.type === "langs") {
      const on = Array.isArray(v) && (v as string[]).includes("en")
      return (
        <div key={f.key} className="flex items-center justify-between gap-4 py-2">
          <div>{label}<Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text></div>
          <Switch id={f.key} data-testid="set-languages-en" checked={on} onCheckedChange={(c) => set(f.key, (c ? ["ar", "en"] : ["ar"]) as unknown as Val)} />
        </div>
      )
    }
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
            setMsg({ tab: "identity", ok: true, text: t(`settings.uploaded.${kind}`, { n: out.changes.length }) })
            await load()
          } catch (e) {
            setMsg({ tab: "identity", ok: false, text: errorText((e as Error).message) })
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
          setMsg({ tab: "identity", ok: true, text: t("settings.imageReset") }); await load()
        } catch (e) { setMsg({ tab: "identity", ok: false, text: errorText((e as Error).message) }) }
      }
      return (
        <div key={f.key} className="flex items-center gap-4 py-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-ui-bg-subtle">
            {url ? <img src={url} alt="" className="max-h-full max-w-full" data-testid={`img-${kind}`} /> : <Text size="xsmall" className="text-ui-fg-subtle">{t("settings.defaultImage")}</Text>}
          </div>
          <div className="grid gap-1">
            {label}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/png,image/jpeg,image/webp" data-testid={`upload-${kind}`} onChange={(e) => upload(e.target.files?.[0])} />
              {url && <Button size="small" variant="secondary" onClick={reset} data-testid={`reset-${kind}`}>{t("settings.resetImage")}</Button>}
            </div>
            {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
          </div>
        </div>
      )
    }
    if (f.type === "palette") {
      const custom = data?.defaults["theme.palette"] === "custom"
      // أسماء اللوحات الجاهزة من naqla.presets (presets.json عربي ومشترك مع لوحة نقلة الرئيسية)
      const opts = [...(custom ? [{ slug: "custom", name: t("settings.customPalette"), use: t("settings.customPaletteUse"), light: {} as Record<string, string> }] : []), ...(data?.presets.palettes ?? []).map((p) => ({ ...p, name: tOr(`presets.palettes.${p.slug}.name`, p.name), use: p.use && tOr(`presets.palettes.${p.slug}.use`, p.use) }))]
      return (
        <div key={f.key} className="grid gap-2 py-2">
          {label}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="radiogroup" aria-label={title}>
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
      const opts = [...(custom ? [{ slug: "custom", name: t("settings.customFonts"), display: "", body: "" }] : []), ...(data?.presets.fonts ?? []).map((x) => ({ ...x, name: tOr(`presets.fonts.${x.slug}`, x.name) }))]
      return (
        <div key={f.key} className="grid gap-2 py-2">
          {label}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3" role="radiogroup" aria-label={title}>
            {opts.map((x) => (
              <button key={x.slug} type="button" role="radio" aria-checked={v === x.slug} data-testid={`font-${x.slug}`} onClick={() => set(f.key, x.slug)}
                className={`rounded-lg border p-3 text-start ${v === x.slug ? "border-ui-fg-interactive ring-1 ring-ui-fg-interactive" : ""}`}>
                {/* عيّنة الخط العربي (الخطوط عربية أصلاً) ثم اسم الزوج بلغة اللوحة */}
                <div lang="ar" dir="rtl" style={{ fontFamily: x.display ? `"${FAMILY(x.display)}"` : undefined, fontSize: 18, fontWeight: 700 }}>{"عباءة مطرزة" /* i18n-ok */}</div>
                <div style={{ fontFamily: x.body ? `"${FAMILY(x.body)}"` : undefined, fontSize: 13 }}>{x.name} — <span lang="ar">{"توصيل لكل المحافظات" /* i18n-ok */}</span></div>
              </button>
            ))}
          </div>
        </div>
      )
    }
    if (f.type === "select") {
      const opts = f.options ? f.options.map((o) => ({ value: o, label: t(`settings.options.${k}.${o}`) })) : f.key === "location.province" ? (data?.governorates ?? []).map((g) => ({ value: g.code, label: g.name })) : wilayats
      return (
        <div key={f.key} className="grid gap-1 py-2">
          {label}
          <Select value={(v as string) ?? ""} onValueChange={(x) => { set(f.key, x); if (f.key === "location.province") set("location.wilayat", null) }}>
            <Select.Trigger data-testid={`set-${f.key}`}><Select.Value placeholder={t("settings.choose")} /></Select.Trigger>
            <Select.Content>{opts.map((o) => <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>)}</Select.Content>
          </Select>
        </div>
      )
    }
    return (
      <div key={f.key} className="grid gap-1 py-2">
        {label}
        <Input id={f.key} data-testid={`set-${f.key}`} dir={f.dir ?? "auto"} type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder} value={v == null ? "" : String(v)}
          onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />
        {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
      </div>
    )
  }

  // معاينة حية للهوية قبل الحفظ (اللوحة والخط والاسم من المسودة) — معاينة الواجهة العربية كما تراها الزبونة (lang=ar)
  const preview = (() => {
    if (!data) return null
    const pal = data.presets.palettes.find((p) => p.slug === draft["theme.palette"])
    const font = data.presets.fonts.find((x) => x.slug === draft["theme.font"])
    const card = (mode: "light" | "dark") => {
      const c = pal?.[mode]
      if (!c) return <div key={mode} className="rounded-lg border p-4 text-ui-fg-subtle">{t("settings.customIdentity")}</div>
      return (
        <div key={mode} data-testid={`preview-${mode}`} lang="ar" dir="rtl" style={{ background: c.bg, color: c.ink, borderRadius: pal!.radius.lg, padding: 14, fontFamily: font ? `"${FAMILY(font.body)}"` : undefined }}>
          <div style={{ fontFamily: font ? `"${FAMILY(font.display)}"` : undefined, fontWeight: 700, fontSize: 18, color: c.accent }}>{String(draft.name ?? "")}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{String(draft.tagline ?? "")}</div>
          <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: pal!.radius.md, padding: 10, marginTop: 10 }}>
            <div style={{ fontWeight: 600 }}>{"عباءة مطرزة بحواف ذهبية" /* i18n-ok */}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
              <bdi style={{ color: c.accent, fontWeight: 700 }}>{"24.500 ر.ع" /* i18n-ok */}</bdi>
              <s style={{ color: c.muted, fontSize: 12 }}><bdi>29.000</bdi></s>
              <bdi dir="ltr" style={{ background: c.copper, color: c["copper-ink"], borderRadius: pal!.radius.sm, fontSize: 11, padding: "1px 6px" }}>-16%</bdi>
            </div>
            <div style={{ background: c.accent, color: c["accent-ink"], borderRadius: pal!.radius.sm, textAlign: "center", padding: 8, marginTop: 8, fontWeight: 600 }}>{"أضف إلى السلة" /* i18n-ok */}</div>
          </div>
          <div style={{ background: c.footer, color: c["footer-ink"], borderRadius: pal!.radius.sm, padding: 8, marginTop: 10, fontSize: 11 }}>© {String(draft.name ?? "")}</div>
        </div>
      )
    }
    return <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="identity-preview">{card("light")}{card("dark")}</div>
  })()
  const fontsHref = data ? `https://fonts.googleapis.com/css2?${[...new Set(data.presets.fonts.flatMap((x) => [x.display, x.body, x.latin]).filter((x): x is string => !!x && x !== "none"))].map((x) => `family=${FAMILY(x).replace(/ /g, "+")}:wght@400;700`).join("&")}&display=swap` : ""

  if (!data) return <Container><Text>{t("common.loading")}</Text></Container>
  return (
    <div className="flex flex-col gap-y-3" data-testid="naqla-store-settings">
      <Container className="p-0">
        <div className="px-6 py-4"><Heading>{t("settings.title")}</Heading><Text size="small" className="text-ui-fg-subtle">{t("settings.sub")}</Text></div>
        <Tabs defaultValue="features" className="px-6 pb-6">
          <Tabs.List>{TABS.map((tab) => <Tabs.Trigger key={tab.id} value={tab.id} data-testid={`tab-${tab.id}`}>{t(`settings.tabs.${tab.id}`)}</Tabs.Trigger>)}</Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Content key={tab.id} value={tab.id} className="pt-4">
              {tab.id === "shipping" ? <ShippingTab onSaved={load} /> : tab.id === "payments" ? <PaymentsTab onSaved={load} /> : (
                <div className={`${tab.id === "identity" ? "max-w-4xl" : "max-w-2xl"} divide-y`}>
                  {tab.id === "identity" && <><link rel="stylesheet" href={fontsHref} /><div className="pb-4"><Text size="small" weight="plus" className="mb-2">{t("settings.previewTitle")}</Text>{preview}</div></>}
                  {tab.fields!.map(field)}
                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={() => save(tab.id, tab.fields!)} isLoading={saving === tab.id} data-testid={`save-${tab.id}`}>{t("common.save")}</Button>
                    {msg?.tab === tab.id && <Text size="small" data-testid="settings-msg" className={msg.ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{msg.text}</Text>}
                  </div>
                </div>
              )}
            </Tabs.Content>
          ))}
        </Tabs>
      </Container>
      <Container>
        <Heading level="h2">{t("settings.history")}</Heading>
        <div className="mt-3 grid gap-2" data-testid="settings-history">
          {/* مفاتيح تقنية وقيم محفوظة (بيانات)؛ القيم الثابتة «~…» من الخادم تُترجم */}
          {data.history.length ? data.history.map((h, i) => (
            <Text key={i} size="small"><b>{new Date(h.at).toLocaleString(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB")}</b> — {h.by ?? "—"}: <Data>{h.changes.map((c) => t("settings.change", { key: c.key, from: JSON.stringify(token(c.from)), to: JSON.stringify(token(c.to)) })).join(t("common.listSep"))}</Data></Text>
          )) : <Text size="small" className="text-ui-fg-subtle">{t("settings.noHistory")}</Text>}
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "naqla.nav.settings", translationNs: "translation", icon: BuildingStorefront, rank: 0 })
export default StoreSettingsPage
