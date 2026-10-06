import { useEffect, useState } from "react"
import { GOVERNORATES, PAYMENT, SHIPPING } from "./oman"

/**
 * أسماء المحافظات والتوصيل من إعداد العميل (/admin/naqla/labels)، والثابتة احتياطاً حتى تصل.
 * أسماء الدفع خاصة بالمنصة (ثابتة لكل العملاء).
 */
let cache: { governorates: Record<string, string>; shipping: Record<string, string> } | null = null
export function useStoreLabels() {
  const [labels, setLabels] = useState(cache ?? { governorates: GOVERNORATES, shipping: SHIPPING })
  useEffect(() => {
    if (cache) return
    fetch("/admin/naqla/labels", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { cache = d; setLabels(d) } })
      .catch(() => null)
  }, [])
  return { ...labels, payment: PAYMENT }
}
