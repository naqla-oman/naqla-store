import { storeConfig } from "../../store.config"

/** بيانات التفصيل المحفوظة مع سطر السلة/الطلب (line item metadata.tailoring) */
export type TailoringMeta = {
  for?: string
  for_handle?: string
  measurements?: Record<string, number> | null
  contact?: boolean
}

/** «لـ عباءة كلاسيكية · الطول 160 · الصدر 100 …» أو «… · سنتواصل لأخذ المقاسات» */
export function tailoringNote(meta: unknown): string | null {
  const t = (meta as any)?.tailoring as TailoringMeta | undefined
  if (!t) return null
  const defs = storeConfig.tailoring?.measurements ?? []
  const parts = [t.for ? `لـ ${t.for}` : null]
  if (t.contact) parts.push("سنتواصل لأخذ المقاسات")
  else if (t.measurements) {
    for (const d of defs) if (t.measurements[d.key]) parts.push(`${d.label} ${t.measurements[d.key]}`)
  }
  return parts.filter(Boolean).join(" · ")
}
