import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Badge, Text } from "@medusajs/ui"
import { Card, PageHead, useNaqla } from "../../components/naqla-ui"
import { useNaqlaT } from "../../lib/naqla-i18n"

type Version = { env: string; name: string | null; preview: string | null; params: string[] }
type W = {
  enabled: boolean
  credentials: { token: boolean; phoneNumberId: boolean }
  language: string
  languageEn: string
  templates: (Version & { key: string; category: string; en?: Version })[]
}

/**
 * نسخة قالب: النص كما يُعتمد في Meta بلغته. المعاينة العربية محتوى عربي أصلاً (lang=ar) لا نص واجهة —
 * تبقى عربية في اللوحة الإنجليزية (stage5 يستثني [lang=ar]).
 */
const TemplateVersion = ({ v, lang, testid }: { v: Version; lang: "ar" | "en"; testid: string }) => {
  const { t } = useNaqlaT()
  return (
    <div className="grid gap-2" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="2xsmall" color="grey">{t(`whatsapp.version.${lang}`)}</Badge>
        <Badge size="2xsmall" color={v.name ? "green" : "grey"}>{v.name ? <span dir="ltr">{v.name}</span> : t("whatsapp.notLinked")}</Badge>
        <Text size="xsmall" className="text-ui-fg-muted" dir="ltr">{v.env}</Text>
      </div>
      <div className="rounded-lg bg-ui-bg-subtle p-3" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}><Text size="small">{v.preview}</Text></div>
      {!!v.params.length && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {t("whatsapp.params")} <span lang={lang}>{v.params.map((p, i) => <span key={i}>{i ? " · " : ""}<span dir="ltr">{`{{${i + 1}}}`}</span> <bdi>{p}</bdi></span>)}</span>
        </Text>
      )}
    </div>
  )
}

/** قوالب واتساب: النصوص المطلوب اعتمادها من Meta (عربية وإنجليزية — المرحلة 4) وحالة ربط كل قالب */
const WhatsappPage = () => {
  const { t } = useNaqlaT()
  const { data: d, error } = useNaqla<W>("/admin/naqla/whatsapp")
  const set = (on: boolean) => t(on ? "whatsapp.set" : "whatsapp.unset")
  return (
    <div className="flex flex-col gap-y-3" data-testid="naqla-whatsapp">
      <PageHead title={t("whatsapp.title")} sub={t("whatsapp.sub")}>
        {d && <Badge color={d.enabled ? "green" : "orange"}>{t(d.enabled ? "whatsapp.enabled" : "whatsapp.devMode")}</Badge>}
      </PageHead>
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <>
          <Card title={t("whatsapp.account")}>
            <div className="flex flex-wrap gap-2">
              <Badge color={d.credentials.token ? "green" : "grey"}>{t("whatsapp.token")} {set(d.credentials.token)}</Badge>
              <Badge color={d.credentials.phoneNumberId ? "green" : "grey"}>{t("whatsapp.phone")} {set(d.credentials.phoneNumberId)}</Badge>
              <Badge color="grey">{t("whatsapp.language")} <span dir="ltr">{d.language} · {d.languageEn}</span></Badge>
            </div>
          </Card>
          {d.templates.map((tpl) => (
            <Card key={tpl.key} title={t(`whatsapp.templates.${tpl.key}`)} testid={`tpl-${tpl.key}`}>
              <div className="mb-2"><Badge size="2xsmall" color="blue">{tpl.category}</Badge></div>
              {tpl.key === "otp" ? (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="2xsmall" color={tpl.name ? "green" : "grey"}>{tpl.name ? <span dir="ltr">{tpl.name}</span> : t("whatsapp.notLinked")}</Badge>
                    <Text size="xsmall" className="text-ui-fg-muted" dir="ltr">{tpl.env}</Text>
                  </div>
                  <div className="rounded-lg bg-ui-bg-subtle p-3"><Text size="small">{t("whatsapp.otpPreview")}</Text></div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <TemplateVersion v={tpl} lang="ar" testid={`tpl-${tpl.key}-ar`} />
                  {tpl.en ? <TemplateVersion v={tpl.en} lang="en" testid={`tpl-${tpl.key}-en`} /> : <Text size="xsmall" className="text-ui-fg-muted">{t("whatsapp.arabicOnly")}</Text>}
                </div>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "naqla.nav.whatsapp", translationNs: "translation", icon: ChatBubbleLeftRight, rank: 4 })
export default WhatsappPage
