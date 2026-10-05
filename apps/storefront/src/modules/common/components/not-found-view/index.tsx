import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "../../../../store.config"

/** M23: صفحة 404 عربية بتصميم المتجر (بدل نص Medusa الإنجليزي) */
export default function NotFoundView({ title = "الصفحة غير موجودة", hint }: { title?: string; hint?: string }) {
  return (
    <div className="wrap" style={{ minHeight: "60vh", display: "grid", placeItems: "center", paddingBlock: 48 }} data-testid="not-found">
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "14px 0 8px" }}>{title}</h1>
        <p style={{ color: "var(--muted)", margin: "0 0 22px" }}>
          {hint ?? `ربما تغيّر الرابط أو لم يعد المنتج متاحاً. تصفّح ${storeConfig.name} من هنا:`}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <LocalizedClientLink href="/" className="btn">الرئيسية</LocalizedClientLink>
          <LocalizedClientLink href="/store" className="btn ghost"><Icon name="search" size={16} /> المتجر</LocalizedClientLink>
          <LocalizedClientLink href="/track" className="btn ghost">تتبّع طلب</LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}
