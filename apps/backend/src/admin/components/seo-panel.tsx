import { Button, Container, Heading, Input, Label, Text, Textarea } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { naqlaApi, useNaqlaT } from "../lib/naqla-i18n"

type Props = {
  kind: "product" | "category"
  id: string
  title: string
  handle: string
  description?: string | null
  metadata?: Record<string, unknown> | null
}

const LIMIT = { title: 60, desc: 160 }

/**
 * لوحة السيو: العنوان والوصف والرابط مع معاينة نتيجة قوقل؛ تغيير الرابط يُنشئ تحويل 301 تلقائياً.
 * الحقول تحفظ القيم العربية (أصل الكيان)، والمعاينة لنتيجة الصفحة العربية — بيانات لا نص واجهة.
 */
export default function SeoPanel({ kind, id, title, handle, description, metadata }: Props) {
  const { t: tr, lang, errorText } = useNaqlaT()
  const [cfg, setCfg] = useState<{ storefront: string; country: string; name: string } | null>(null)
  const [t, setT] = useState(String(metadata?.seo_title ?? ""))
  const [d, setD] = useState(String(metadata?.seo_description ?? ""))
  const [h, setH] = useState(handle)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  useEffect(() => {
    fetch("/admin/seo/config", { credentials: "include" }).then((r) => r.json()).then(setCfg).catch(() => null)
  }, [])

  const shownTitle = `${t || title}${cfg ? ` | ${cfg.name}` : ""}`
  const shownDesc = d || (description ?? "").slice(0, LIMIT.desc)
  const path = `${kind === "product" ? "products" : "categories"}/${h}`
  const url = cfg ? `${cfg.storefront.replace(/^https?:\/\//, "")} › ${cfg.country} › ${path.replace("/", " › ")}` : path

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      await naqlaApi(`/admin/seo/${kind}/${id}`, lang, { method: "POST", body: JSON.stringify({ seo_title: t, seo_description: d, handle: h }) })
      setMsg({ ok: true, t: h !== handle ? tr("seo.savedRedirect") : tr("common.saved") })
    } catch (e: any) {
      setMsg({ ok: false, t: errorText(e.message) })
    } finally { setBusy(false) }
  }

  const count = (n: number, max: number) => (
    <Text size="xsmall" className={n > max ? "text-ui-fg-error" : "text-ui-fg-muted"}>{n}/{max}</Text>
  )

  return (
    <Container className="divide-y p-0" data-testid={`seo-${kind}`}>
      <div className="px-6 py-4"><Heading level="h2">{tr("seo.title")}</Heading></div>
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between"><Label size="small" htmlFor="seo-title">{tr("seo.seoTitle")}</Label>{count(t.length, LIMIT.title)}</div>
          <Input id="seo-title" size="small" value={t} placeholder={title} onChange={(e) => setT(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between"><Label size="small" htmlFor="seo-desc">{tr("seo.description")}</Label>{count(d.length, LIMIT.desc)}</div>
          <Textarea id="seo-desc" rows={3} value={d} placeholder={(description ?? "").slice(0, LIMIT.desc)} onChange={(e) => setD(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small" htmlFor="seo-handle">{tr("seo.handle")}</Label>
          <Input id="seo-handle" size="small" dir="ltr" value={h} onChange={(e) => setH(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
          {h !== handle && <Text size="xsmall" className="text-ui-fg-subtle">{tr("seo.redirectBefore")}<bdi dir="ltr">{handle}</bdi>{tr("seo.redirectAfter")}</Text>}
        </div>
      </div>
      <div className="px-6 py-4" data-testid="seo-preview">
        <Text size="xsmall" className="mb-2 text-ui-fg-muted">{tr("seo.preview")}</Text>
        <div className="rounded-lg border bg-ui-bg-base p-3" style={{ fontFamily: "Arial, sans-serif" }} data-content="" dir="auto">
          <div dir="ltr" style={{ color: "#4d5156", fontSize: 12 }}>{url}</div>
          <div style={{ color: "#1a0dab", fontSize: 18, lineHeight: 1.3, margin: "4px 0" }}>{shownTitle.length > 65 ? shownTitle.slice(0, 64) + "…" : shownTitle}</div>
          <div style={{ color: "#4d5156", fontSize: 13, lineHeight: 1.5 }}>{shownDesc.length > 160 ? shownDesc.slice(0, 159) + "…" : shownDesc}</div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-3">
        {msg && <Text size="small" className={msg.ok ? "text-ui-fg-interactive" : "text-ui-fg-error"}>{msg.t}</Text>}
        <Button size="small" onClick={save} isLoading={busy} data-testid="seo-save">{tr("seo.save")}</Button>
      </div>
    </Container>
  )
}
