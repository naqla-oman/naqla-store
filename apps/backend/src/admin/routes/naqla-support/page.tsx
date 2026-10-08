import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Phone } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { PageHead, useNaqla } from "../../components/naqla-ui"
import { Data, useNaqlaT } from "../../lib/naqla-i18n"

type S = { contact: Record<string, string>; store: { name: string; slug: string }; platform: { version: string } }

/** بطاقة «الدعم الفني من نقلة» */
const SupportPage = () => {
  const { t } = useNaqlaT()
  const { data: d, error } = useNaqla<S>("/admin/naqla/support")
  const c = d?.contact ?? {}
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(t("support.waText", { name: d?.store.name, slug: d?.store.slug }))}` : null
  return (
    <div className="flex flex-col gap-y-3" data-testid="naqla-support">
      <PageHead title={t("support.title")} sub={t("support.sub")} />
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <Container className="overflow-hidden p-0">
          <div className="flex items-center gap-4 px-6 py-6" style={{ background: "linear-gradient(135deg, #041B3F, #03635E)" }}>
            <img src="/naqla-brand/logo-horizontal-white.png" alt={t("brand.name")} className="h-12 w-auto" />
            <Text className="text-white/80" size="small">{t("brand.tagline")}</Text>
          </div>
          <div className="flex flex-col gap-3 px-6 py-5">
            {wa && <Button asChild><a href={wa} target="_blank" rel="noopener noreferrer">{t("support.whatsapp")}</a></Button>}
            {c.phone && <Text>{t("support.phone")} <a dir="ltr" href={`tel:${c.phone}`} className="text-ui-fg-interactive">{c.phone}</a></Text>}
            {c.email && <Text>{t("support.email")} <a dir="ltr" href={`mailto:${c.email}`} className="text-ui-fg-interactive">{c.email}</a></Text>}
            {c.hours && <Text className="text-ui-fg-subtle">{t("support.hours")} <Data>{c.hours}</Data></Text>}
            {c.website && <Text>{t("support.website")} <a dir="ltr" href={c.website} target="_blank" rel="noopener noreferrer" className="text-ui-fg-interactive">{c.website.replace(/^https?:\/\//, "")}</a></Text>}
            <div className="mt-2 rounded-lg bg-ui-bg-subtle p-3">
              <Heading level="h3" className="mb-1">{t("support.mention")}</Heading>
              <Text size="small" className="text-ui-fg-subtle">{t("support.store")} <Data>{d.store.name}</Data> (<span dir="ltr">{d.store.slug}</span>){d.platform.version ? ` · ${t("support.version", { v: d.platform.version })}` : ""}</Text>
            </div>
          </div>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "naqla.nav.support", translationNs: "translation", icon: Phone, rank: 5 })
export default SupportPage
