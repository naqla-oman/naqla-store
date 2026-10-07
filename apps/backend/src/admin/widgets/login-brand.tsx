import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Data, useNaqlaT } from "../lib/naqla-i18n"

/** صفحة الدخول: شعار نقلة، وتحته اسم متجر العميل وشعاره الصغير (من clients/<STORE>) */
const LoginBrand = () => {
  const { t } = useNaqlaT()
  const [store, setStore] = useState<{ name: string } | null>(null)
  useEffect(() => {
    fetch("/naqla-brand/client.json").then((r) => r.json()).then(setStore).catch(() => null)
  }, [])
  return (
    <div className="mb-6 flex flex-col items-center gap-4" data-testid="login-brand">
      <img src="/naqla-brand/logo-horizontal.png" alt={`${t("brand.name")} — ${t("brand.tagline")}`} className="h-14 w-auto dark:hidden" />
      <img src="/naqla-brand/logo-horizontal-white.png" alt={t("brand.name")} className="hidden h-14 w-auto dark:block" />
      {store && (
        <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-elevation-card-rest">
          <img src="/naqla-brand/client-logo.png" alt="" className="h-6 w-6 rounded-md" />
          <Text size="small" weight="plus"><Data>{store.name}</Data></Text>
        </div>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({ zone: "login.before" })
export default LoginBrand
