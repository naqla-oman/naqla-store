import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

/** صفحة الدخول: شعار نقلة، وتحته اسم متجر العميل وشعاره الصغير (من clients/<STORE>) */
const LoginBrand = () => {
  const [store, setStore] = useState<{ name: string } | null>(null)
  useEffect(() => {
    fetch("/naqla-brand/client.json").then((r) => r.json()).then(setStore).catch(() => null)
  }, [])
  return (
    <div className="mb-6 flex flex-col items-center gap-4" dir="rtl" data-testid="login-brand">
      <img src="/naqla-brand/logo-horizontal.png" alt="نقلة — نرتب ظهور مشروعك الرقمي" className="h-14 w-auto dark:hidden" />
      <img src="/naqla-brand/logo-horizontal-white.png" alt="نقلة" className="hidden h-14 w-auto dark:block" />
      {store && (
        <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-elevation-card-rest">
          <img src="/naqla-brand/client-logo.png" alt="" className="h-6 w-6 rounded-md" />
          <Text size="small" weight="plus">{store.name}</Text>
        </div>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({ zone: "login.before" })
export default LoginBrand
