import { storeConfig } from "../../store.config"

/** بيانات التفصيل المحفوظة مع سطر السلة/الطلب (line item metadata.tailoring) */
export type TailoringMeta = {
  for?: string
  for_handle?: string
  measurements?: Record<string, number> | null
  contact?: boolean
}

/** «لـ عباءة كلاسيكية · الطول 160 · الصدر 100 …» أو «… · سنتواصل لأخذ المقاسات» */
type Tr = (key: string, vals?: Record<string, string | number>) => string
export function tailoringNote(meta: unknown, tr: Tr): string | null {
  const t = (meta as any)?.tailoring as TailoringMeta | undefined
  if (!t) return null
  const defs = storeConfig.tailoring?.measurements ?? []
  const parts = [t.for ? tr("common.forItem", { item: t.for }) : null]
  if (t.contact) parts.push(tr("common.willContact"))
  else if (t.measurements) {
    for (const d of defs) if (t.measurements[d.key]) parts.push(`${d.label} ${t.measurements[d.key]}`)
  }
  return parts.filter(Boolean).join(" · ")
}
