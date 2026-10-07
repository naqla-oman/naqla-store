import { useEffect, useState } from "react"
import { type Lang, naqlaApi, useNaqlaT } from "./naqla-i18n"

/**
 * أسماء المحافظات والتوصيل من إعداد العميل بلغة اللوحة (/admin/naqla/labels + x-naqla-lang)؛ قبل وصولها يظهر الرمز.
 * أسماء الدفع خاصة بالمنصة (ثابتة لكل العملاء) من naqla.payment.<channel>.
 */
type Labels = { governorates: Record<string, string>; shipping: Record<string, string>; wilayats: Record<string, string> }
const cache: Partial<Record<Lang, Labels>> = {}
const PAYMENT = ["cod", "whatsapp", "thawani"]
export function useStoreLabels() {
  const { t, lang } = useNaqlaT()
  const [labels, setLabels] = useState<Labels>(cache[lang] ?? { governorates: {}, shipping: {}, wilayats: {} })
  useEffect(() => {
    if (cache[lang]) return setLabels(cache[lang]!)
    naqlaApi<Labels>("/admin/naqla/labels", lang)
      .then((d) => { cache[lang] = d; setLabels(d) })
      .catch(() => null)
  }, [lang])
  return { ...labels, payment: Object.fromEntries(PAYMENT.map((k) => [k, t(`payment.${k}`)])) as Record<string, string> }
}
