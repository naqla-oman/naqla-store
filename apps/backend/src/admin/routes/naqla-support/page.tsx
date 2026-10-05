import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Phone } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { PageHead, useNaqla } from "../../components/naqla-ui"

type S = { contact: Record<string, string>; store: { name: string; slug: string }; platform: { version: string } }

/** بطاقة «الدعم الفني من نقلة» */
const SupportPage = () => {
  const { data: d, error } = useNaqla<S>("/admin/naqla/support")
  const c = d?.contact ?? {}
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً نقلة، أحتاج دعماً فنياً لمتجر ${d?.store.name} (${d?.store.slug})`)}` : null
  return (
    <div className="flex flex-col gap-y-3" dir="rtl" data-testid="naqla-support">
      <PageHead title="الدعم الفني من نقلة" sub="نحن هنا لمساعدتك في إدارة متجرك" />
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <Container className="overflow-hidden p-0">
          <div className="flex items-center gap-4 px-6 py-6" style={{ background: "linear-gradient(135deg, #041B3F, #03635E)" }}>
            <img src="/naqla-brand/logo-horizontal-white.png" alt="نقلة" className="h-12 w-auto" />
            <Text className="text-white/80" size="small">نرتب ظهور مشروعك الرقمي</Text>
          </div>
          <div className="flex flex-col gap-3 px-6 py-5">
            {wa && <Button asChild><a href={wa} target="_blank" rel="noopener noreferrer">مراسلة الدعم على واتساب</a></Button>}
            {c.phone && <Text>الهاتف: <a dir="ltr" href={`tel:${c.phone}`} className="text-ui-fg-interactive">{c.phone}</a></Text>}
            {c.email && <Text>البريد: <a dir="ltr" href={`mailto:${c.email}`} className="text-ui-fg-interactive">{c.email}</a></Text>}
            {c.hours && <Text className="text-ui-fg-subtle">ساعات الدعم: {c.hours}</Text>}
            {c.website && <Text>الموقع: <a dir="ltr" href={c.website} target="_blank" rel="noopener noreferrer" className="text-ui-fg-interactive">{c.website.replace(/^https?:\/\//, "")}</a></Text>}
            <div className="mt-2 rounded-lg bg-ui-bg-subtle p-3">
              <Heading level="h3" className="mb-1">عند طلب الدعم اذكر:</Heading>
              <Text size="small" className="text-ui-fg-subtle">المتجر: {d.store.name} (<span dir="ltr">{d.store.slug}</span>){d.platform.version ? ` · إصدار نقلة ${d.platform.version}` : ""}</Text>
            </div>
          </div>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "الدعم الفني", icon: Phone, rank: 5 })
export default SupportPage
