import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * المرحلة 2: ويدجت «اكتمال الترجمة» في صفحة المنتج — يظهر فقط حين تكون الإنجليزية مفعّلة في إعدادات المتجر.
 * يقرأ ترجمات en-US للمنتج وخياراته وقيمها من وحدة الترجمة، ويعدّد ما ينقص (الاسم، الوصف، أسماء الخيارات، القيم).
 * التعديل من قائمة «الترجمات» في اللوحة (Medusa) أو من ملف clients/<slug>/locales/en.json ثم pnpm i18n:sync.
 */
const LOCALE = "en-US"
const FIELDS: [keyof AdminProduct & string, string][] = [["title", "الاسم"], ["subtitle", "العنوان الفرعي"], ["description", "الوصف"], ["material", "الخامة"]]

type Tr = { reference: string; reference_id: string; translations: Record<string, string> }

async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: "include" })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

const ProductTranslationWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [missing, setMissing] = useState<string[] | null>(null)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await api<{ values: Record<string, unknown> }>("/admin/naqla/store-settings")
        const langs = (s.values?.languages as string[] | null) ?? ["ar"]
        if (!langs.includes("en")) { if (alive) setEnabled(false); return }
        if (alive) setEnabled(true)
        const ids = [data.id, ...(data.options ?? []).flatMap((o) => [o.id, ...(o.values ?? []).map((v) => v.id)])]
        const q = ids.map((id) => `reference_id[]=${encodeURIComponent(id)}`).join("&")
        const res = await api<{ translations: Tr[] }>(`/admin/translations?locale_code=${LOCALE}&${q}&limit=500`)
        const byId = new Map(res.translations.map((t) => [t.reference_id, t.translations ?? {}]))
        const miss: string[] = []
        let n = 0, ok = 0
        const p = byId.get(data.id) ?? {}
        for (const [k, label] of FIELDS) {
          if (!data[k]) continue
          n++
          if (p[k]) ok++; else miss.push(label)
        }
        for (const o of data.options ?? []) {
          n++
          if (byId.get(o.id)?.title) ok++; else miss.push(`خيار «${o.title}»`)
          for (const v of o.values ?? []) {
            n++
            if (byId.get(v.id)?.value) ok++; else miss.push(`قيمة «${v.value}»`)
          }
        }
        if (alive) { setMissing(miss); setDone(ok); setTotal(n) }
      } catch {
        if (alive) setMissing([])
      }
    })()
    return () => { alive = false }
  }, [data.id, data.title, data.description, data.options])

  if (enabled === false) return null
  const complete = missing !== null && missing.length === 0
  return (
    <Container className="divide-y p-0" data-testid="translation-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">الترجمة الإنجليزية</Heading>
        {missing === null ? <Badge size="2xsmall">…</Badge> : complete ? <Badge color="green" size="2xsmall">مكتملة</Badge> : <Badge color="orange" size="2xsmall">{`ناقصة ${missing.length}`}</Badge>}
      </div>
      <div className="px-6 py-4 flex flex-col gap-2">
        {missing !== null && total > 0 && <Text size="small" className="text-ui-fg-subtle">{done} من {total} حقلاً مترجم</Text>}
        {missing && missing.length > 0 && (
          <ul className="list-disc ps-5 text-sm">
            {missing.slice(0, 12).map((m) => <li key={m}>{m}</li>)}
            {missing.length > 12 && <li>و{missing.length - 12} أخرى…</li>}
          </ul>
        )}
        {complete && <Text size="small">كل حقول المنتج وخياراته مترجمة. يظهر المنتج بالإنجليزية في /en.</Text>}
        {missing && missing.length > 0 && <Text size="small" className="text-ui-fg-subtle">ما لا ترجمة له يظهر بالعربية في الواجهة الإنجليزية. أضف الترجمة من «Translations» أو من ملف locales/en.json ثم pnpm i18n:sync.</Text>}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })
export default ProductTranslationWidget
