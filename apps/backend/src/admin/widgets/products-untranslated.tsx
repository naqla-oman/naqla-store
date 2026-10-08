import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Data, useNaqlaT } from "../lib/naqla-i18n"

/**
 * المرحلة 2: مؤشر «بلا ترجمة» أعلى قائمة المنتجات — عدد المنتجات بلا اسم إنجليزي (en-US) وأسماؤها.
 * يظهر فقط حين تكون الإنجليزية مفعّلة في إعدادات المتجر، ويختفي حين تكتمل الترجمة.
 */
const LOCALE = "en-US"

async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: "include" })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

const ProductsUntranslatedWidget = () => {
  const { t } = useNaqlaT()
  const [state, setState] = useState<{ names: string[]; total: number } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await api<{ values: Record<string, unknown> }>("/admin/naqla/store-settings")
        if (!((s.values?.languages as string[] | null) ?? ["ar"]).includes("en")) return
        const { products } = await api<{ products: { id: string; title: string }[] }>("/admin/products?fields=id,title&limit=500&status[]=published&status[]=draft")
        if (!products.length) { if (alive) setState({ names: [], total: 0 }); return }
        const q = products.map((p) => `reference_id[]=${encodeURIComponent(p.id)}`).join("&")
        const { translations } = await api<{ translations: { reference_id: string; translations: Record<string, string> }[] }>(`/admin/translations?locale_code=${LOCALE}&reference=product&${q}&limit=500`)
        const ok = new Set(translations.filter((t) => t.translations?.title).map((t) => t.reference_id))
        const names = products.filter((p) => !ok.has(p.id)).map((p) => p.title)
        if (alive) setState({ names, total: products.length })
      } catch { /* بلا وحدة ترجمة أو بلا صلاحية: لا شيء يُعرض */ }
    })()
    return () => { alive = false }
  }, [])

  if (!state || state.names.length === 0) return null
  return (
    <Container className="flex items-center gap-3 px-6 py-3" data-testid="untranslated-indicator">
      <Badge color="orange" size="2xsmall">{t("untranslated.badge")}</Badge>
      <Text size="small">
        {t("untranslated.count", { n: state.names.length, count: state.total })} <Data>{state.names.slice(0, 6).join(t("common.listSep"))}</Data>
        {state.names.length > 6 ? ` ${t("untranslated.more", { n: state.names.length - 6 })}` : ""}
      </Text>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.list.before" })
export default ProductsUntranslatedWidget
