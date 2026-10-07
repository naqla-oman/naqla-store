import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "../../../../store.config"
import { useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

/** M23: صفحة 404 عربية بتصميم المتجر (بدل نص Medusa الإنجليزي) */
export default function NotFoundView({ title, hint }: { title?: string; hint?: string }) {
  const sc = useStoreConfig()
  const t = useT("common")
  title = title ?? t("sbb8423")
  return (
    <div className="wrap" style={{ minHeight: "60vh", display: "grid", placeItems: "center", paddingBlock: 48 }} data-testid="not-found">
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "14px 0 8px" }}>{title}</h1>
        <p style={{ color: "var(--muted)", margin: "0 0 22px" }}>
          {hint ?? t("notFoundHint", { store: sc.name })}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <LocalizedClientLink href="/" className="btn">{t("s3aa857")}</LocalizedClientLink>
          <LocalizedClientLink href="/store" className="btn ghost"><Icon name="search" size={16} /> {t("se18fb6")}</LocalizedClientLink>
          <LocalizedClientLink href="/track" className="btn ghost">{t("s94d17e")}</LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}
