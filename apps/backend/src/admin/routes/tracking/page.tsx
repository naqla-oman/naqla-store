import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Switch, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { naqlaApi, useNaqlaT } from "../../lib/naqla-i18n"

type Settings = Record<string, string | boolean | null>
type Result = { platform: string; ok: boolean; status: number; skipped?: string; response?: string }

// التسميات التقنية (Pixel ID…) بأسمائها في المنصات؛ التلميحات والملاحظات من naqla.tracking (hints.<key>، notes.<id>)
type Field = { key: string; label: string; secret?: boolean; hint?: boolean }
type Platform = { id: "ga4" | "meta" | "snap" | "tiktok" | null; title: string; fields: Field[]; toggle?: string }

const PLATFORMS: Platform[] = [
  {
    id: "ga4", title: "Google Analytics 4",
    fields: [
      { key: "ga4_measurement_id", label: "Measurement ID", hint: true },
      { key: "ga4_api_secret", label: "API secret (Measurement Protocol)", secret: true },
    ],
  },
  {
    id: "meta", title: "Meta (Facebook / Instagram)",
    fields: [
      { key: "meta_pixel_id", label: "Pixel ID" },
      { key: "meta_access_token", label: "Conversions API access token", secret: true },
      { key: "meta_test_event_code", label: "test_event_code", hint: true },
    ],
  },
  {
    id: "snap", title: "Snapchat",
    fields: [
      { key: "snap_pixel_id", label: "Pixel ID" },
      { key: "snap_access_token", label: "Conversions API access token", secret: true },
    ],
    toggle: "snap_test_mode",
  },
  {
    id: "tiktok", title: "TikTok",
    fields: [
      { key: "tiktok_pixel_id", label: "Pixel ID" },
      { key: "tiktok_access_token", label: "Events API access token", secret: true },
      { key: "tiktok_test_event_code", label: "test_event_code", hint: true },
    ],
  },
  {
    id: null, title: "Microsoft Clarity",
    fields: [{ key: "clarity_project_id", label: "Project ID" }],
  },
]

const ResultBox = ({ r }: { r: Result }) => {
  const { t, errorText } = useNaqlaT()
  const tone = r.skipped ? "grey" : r.ok ? "green" : "red"
  const head = r.skipped ? t("tracking.skipped", { reason: errorText(r.skipped) }) : t(r.ok ? "tracking.accepted" : "tracking.rejected")
  return (
    <div className="mt-3 rounded-lg border p-3" data-testid={`result-${r.platform}`}>
      <div className="flex items-center gap-2">
        <Badge color={tone as any} size="2xsmall">{r.skipped ? "—" : `HTTP ${r.status}`}</Badge>
        <Text size="small" weight="plus">{head}</Text>
      </div>
      {r.response && (
        <pre dir="ltr" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-ui-bg-subtle p-2 text-xs">{r.response}</pre>
      )}
    </div>
  )
}

/** «أدوات التتبع»: المعرّفات والرموز تُحفظ في الخادم، والرموز السرية لا تُعرض كاملة بعد الحفظ */
const TrackingPage = () => {
  const { t, lang, errorText } = useNaqlaT()
  const api = (path: string, init?: RequestInit) => naqlaApi(path, lang, init)
  const [s, setS] = useState<Settings>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [testing, setTesting] = useState<string | null>(null)

  useEffect(() => {
    api("/admin/tracking/settings").then((r) => setS(r.settings)).catch((e) => setMsg({ ok: false, t: errorText(e.message) }))
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const body: Settings = {}
      for (const p of PLATFORMS) {
        for (const f of p.fields) body[f.key] = (s[f.key] as string) ?? ""
        if (p.toggle) body[p.toggle] = !!s[p.toggle]
      }
      const r = await api("/admin/tracking/settings", { method: "POST", body: JSON.stringify(body) })
      setS(r.settings); setMsg({ ok: true, t: t("common.saved") })
    } catch (e: any) {
      setMsg({ ok: false, t: errorText(e.message) })
    } finally { setSaving(false) }
  }

  const test = async (id: string) => {
    setTesting(id)
    try {
      const r = await api(`/admin/tracking/test/${id}`, { method: "POST" })
      setResults((x) => ({ ...x, [id]: r.result }))
    } catch (e: any) {
      setResults((x) => ({ ...x, [id]: { platform: id, ok: false, status: 0, response: errorText(e.message) } }))
    } finally { setTesting(null) }
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="tracking-page">
      <Container className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">{t("tracking.title")}</Heading>
          <Text size="small" className="text-ui-fg-subtle">{t("tracking.sub")}</Text>
        </div>
        <div className="flex items-center gap-3">
          {msg && <Text size="small" className={msg.ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{msg.t}</Text>}
          <Button onClick={save} isLoading={saving} data-testid="tracking-save">{t("tracking.save")}</Button>
        </div>
      </Container>
      <Text size="small" className="px-1 text-ui-fg-muted">{t("tracking.saveFirst")}</Text>
      {PLATFORMS.map((p) => (
        <Container key={p.title} className="px-6 py-4" data-testid={`platform-${p.id ?? "clarity"}`}>
          <div className="mb-3 flex items-center justify-between">
            <Heading level="h2">{p.title}</Heading>
            {p.id && (
              <Button size="small" variant="secondary" onClick={() => test(p.id!)} isLoading={testing === p.id} data-testid={`test-${p.id}`}>
                {t("tracking.test")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {p.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <Label size="small" htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  dir="ltr"
                  size="small"
                  type={f.secret ? "password" : "text"}
                  placeholder={f.secret && s[f.key] ? t("tracking.savedSecret") : f.hint ? t(`tracking.hints.${f.key}`) : ""}
                  value={f.secret && String(s[f.key] ?? "").startsWith("••••") ? "" : ((s[f.key] as string) ?? "")}
                  onChange={(e) => setS((x) => ({ ...x, [f.key]: e.target.value }))}
                  data-testid={`field-${f.key}`}
                />
                {f.key.endsWith("test_event_code") && s[f.key] && (() => {
                  // M6: رمز الاختبار يطبَّق على المشتريات الفعلية 24 ساعة فقط
                  const at = s[`${f.key}_at`] ? new Date(String(s[`${f.key}_at`])).getTime() : 0
                  const left = at ? 24 - (Date.now() - at) / 3600_000 : 0
                  return left > 0 ? (
                    <Badge size="2xsmall" color="orange" data-testid={`badge-${f.key}`}>{t("tracking.testActive", { count: Math.ceil(left) })}</Badge>
                  ) : (
                    <Badge size="2xsmall" color="grey" data-testid={`badge-${f.key}`}>{t("tracking.testExpired")}</Badge>
                  )
                })()}
                {f.secret && String(s[f.key] ?? "").startsWith("••••") && (
                  <Text size="xsmall" className="text-ui-fg-muted" dir="ltr">{String(s[f.key])}</Text>
                )}
              </div>
            ))}
          </div>
          {p.toggle && (
            <div className="mt-3 flex items-center gap-2">
              <Switch id={p.toggle} checked={!!s[p.toggle]} onCheckedChange={(v) => setS((x) => ({ ...x, [p.toggle!]: v }))} />
              <Label size="small" htmlFor={p.toggle}>{t(`tracking.toggles.${p.toggle}`)}</Label>
            </div>
          )}
          <Text size="xsmall" className="mt-2 text-ui-fg-muted">{t(`tracking.notes.${p.id ?? "clarity"}`)}</Text>
          {p.id && results[p.id] && <ResultBox r={results[p.id]} />}
        </Container>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({ label: "naqla.nav.tracking", translationNs: "translation", icon: ChartBar, rank: 2 })

export default TrackingPage
