import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { ReactNode, useEffect, useState } from "react"
import { Trans } from "react-i18next"
import { Data, useNaqlaT } from "../lib/naqla-i18n"

/**
 * المرحلة 2: ويدجت «اكتمال الترجمة» في صفحة المنتج — يظهر فقط حين تكون الإنجليزية مفعّلة في إعدادات المتجر.
 * يقرأ ترجمات en-US للمنتج وخياراته وقيمها من وحدة الترجمة، ويعدّد ما ينقص (الاسم، الوصف، أسماء الخيارات، القيم).
 * التعديل من قائمة «الترجمات» في اللوحة (Medusa) أو من ملف clients/<slug>/locales/en.json ثم pnpm i18n:sync.
 */
const LOCALE = "en-US"
const FIELDS: (keyof AdminProduct & string)[] = ["title", "subtitle", "description", "material"]

type Tr = { reference: string; reference_id: string; translations: Record<string, string> }

async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: "include" })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

// عنصر ناقص: حقل المنتج (مفتاح ترجمة)، أو خيار/قيمة باسمها العربي (بيانات)
type Missing = { field: string } | { option: string } | { value: string }

const ProductTranslationWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const { t } = useNaqlaT()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [missing, setMissing] = useState<Missing[] | null>(null)
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
        const miss: Missing[] = []
        let n = 0, ok = 0
        const p = byId.get(data.id) ?? {}
        for (const k of FIELDS) {
          if (!data[k]) continue
          n++
          if (p[k]) ok++; else miss.push({ field: k })
        }
        for (const o of data.options ?? []) {
          n++
          if (byId.get(o.id)?.title) ok++; else miss.push({ option: o.title })
          for (const v of o.values ?? []) {
            n++
            if (byId.get(v.id)?.value) ok++; else miss.push({ value: v.value })
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
  // «خيار «المقاس»» — الاسم بيانات عربية داخل نص مترجم
  const item = (m: Missing): ReactNode => "field" in m ? t(`translation.fields.${m.field}`)
    : <Trans i18nKey={"option" in m ? "naqla.translation.option" : "naqla.translation.value"} components={{ d: <Data /> }} values={{ name: "option" in m ? m.option : m.value }} />
  return (
    <Container className="divide-y p-0" data-testid="translation-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("translation.title")}</Heading>
        {missing === null ? <Badge size="2xsmall">…</Badge> : complete ? <Badge color="green" size="2xsmall">{t("translation.complete")}</Badge> : <Badge color="orange" size="2xsmall">{t("translation.missing", { n: missing.length })}</Badge>}
      </div>
      <div className="px-6 py-4 flex flex-col gap-2">
        {missing !== null && total > 0 && <Text size="small" className="text-ui-fg-subtle">{t("translation.progress", { done, count: total })}</Text>}
        {missing && missing.length > 0 && (
          <ul className="list-disc ps-5 text-sm">
            {missing.slice(0, 12).map((m, i) => <li key={i}>{item(m)}</li>)}
            {missing.length > 12 && <li>{t("translation.more", { n: missing.length - 12 })}</li>}
          </ul>
        )}
        {complete && <Text size="small">{t("translation.allDone")}</Text>}
        {missing && missing.length > 0 && <Text size="small" className="text-ui-fg-subtle">{t("translation.howTo")}</Text>}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })
export default ProductTranslationWidget
