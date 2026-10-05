import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Badge, Text } from "@medusajs/ui"
import { Card, PageHead, useNaqla } from "../../components/naqla-ui"

type W = {
  enabled: boolean
  credentials: { token: boolean; phoneNumberId: boolean }
  language: string
  templates: { key: string; title: string; category: string; env: string; name: string | null; preview: string; params: string[] }[]
}

/** قوالب واتساب: النصوص المطلوب اعتمادها من Meta وحالة ربط كل قالب */
const WhatsappPage = () => {
  const { data: d, error } = useNaqla<W>("/admin/naqla/whatsapp")
  return (
    <div className="flex flex-col gap-y-3" dir="rtl" data-testid="naqla-whatsapp">
      <PageHead title="قوالب واتساب" sub="رمز الدخول وإشعارات مراحل الطلب — تُرسل فقط بعد اعتماد القالب في Meta وربط اسمه">
        {d && <Badge color={d.enabled ? "green" : "orange"}>{d.enabled ? "الإرسال مفعّل" : "وضع التطوير: تُكتب في السجل"}</Badge>}
      </PageHead>
      {error && <Text className="text-ui-fg-error px-1">{error}</Text>}
      {d && (
        <>
          <Card title="الحساب">
            <div className="flex flex-wrap gap-2">
              <Badge color={d.credentials.token ? "green" : "grey"}>رمز الوصول {d.credentials.token ? "مضبوط" : "غير مضبوط"}</Badge>
              <Badge color={d.credentials.phoneNumberId ? "green" : "grey"}>رقم الهاتف {d.credentials.phoneNumberId ? "مضبوط" : "غير مضبوط"}</Badge>
              <Badge color="grey">لغة القوالب: {d.language}</Badge>
            </div>
          </Card>
          {d.templates.map((t) => (
            <Card key={t.key} title={t.title} testid={`tpl-${t.key}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge size="2xsmall" color="blue">{t.category}</Badge>
                <Badge size="2xsmall" color={t.name ? "green" : "grey"}>{t.name ? <span dir="ltr">{t.name}</span> : "لم يُربط قالب معتمد"}</Badge>
                <Text size="xsmall" className="text-ui-fg-muted" dir="ltr">{t.env}</Text>
              </div>
              <div className="rounded-lg bg-ui-bg-subtle p-3"><Text size="small">{t.preview}</Text></div>
              {!!t.params.length && <Text size="xsmall" className="mt-2 text-ui-fg-muted">المتغيرات بالترتيب: {t.params.map((p, i) => `{{${i + 1}}} ${p}`).join(" · ")}</Text>}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "قوالب واتساب", icon: ChatBubbleLeftRight, rank: 4 })
export default WhatsappPage
