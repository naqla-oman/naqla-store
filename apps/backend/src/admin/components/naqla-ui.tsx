import { Container, Heading, Text } from "@medusajs/ui"
import { ReactNode, useEffect, useState } from "react"
import { naqlaApi, useNaqlaT } from "../lib/naqla-i18n"

/** أدوات مشتركة لصفحات قسم «نقلة» في اللوحة — البيانات بلغة اللوحة، وتُعاد عند تغيّرها */
export function useNaqla<T>(path: string) {
  const { lang, errorText } = useNaqlaT()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    naqlaApi<T>(path, lang)
      .then((d) => { if (alive) { setData(d); setError(null) } })
      .catch((e) => { if (alive) setError(errorText(e.message)) })
    return () => { alive = false }
  }, [path, lang, errorText])
  return { data, error }
}

/**
 * العدد مع المعدود بقواعد اللغة (i18next + Intl.PluralRules): naqla.plural.<name>_zero/_one/_two/_few/_many/_other
 * — «طلب واحد / طلبان / 3 طلبات / 11 طلباً / 100 طلب» و«1 order / 3 orders».
 */
export type Countable = "orders" | "pieces" | "customers" | "codes" | "members"
export function useCount() {
  const { t } = useNaqlaT()
  return (n: number, name: Countable) => t(`plural.${name}`, { count: n })
}

export const money = (n: number, label = "") =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)}${label ? ` ${label}` : ""}`

export const PageHead = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <Container className="flex items-center justify-between gap-4 px-6 py-4">
    <div>
      <Heading level="h1">{title}</Heading>
      {sub && <Text size="small" className="text-ui-fg-subtle">{sub}</Text>}
    </div>
    {children}
  </Container>
)

export const Kpi = ({ label, value, hint, tone = "teal", testid }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "teal" | "navy" | "gold" | "green"; testid?: string }) => {
  const bar = { teal: "#03635E", navy: "#041B3F", gold: "#D0A327", green: "#3FA354" }[tone]
  return (
    <Container className="relative overflow-hidden px-5 py-4" data-testid={testid}>
      <span className="absolute inset-y-0 start-0 w-1" style={{ background: bar }} />
      <Text size="small" className="text-ui-fg-subtle">{label}</Text>
      <div className="mt-1 text-2xl font-semibold" style={{ color: "var(--fg-base)" }}>{value}</div>
      {hint && <Text size="xsmall" className="mt-1 text-ui-fg-muted">{hint}</Text>}
    </Container>
  )
}

/** شريط أفقي لكل عنصر بنسبة من الأكبر — الاسم بيانات (Data) أو نص مترجم */
export const BarList = ({ rows, label }: { rows: { key: string; name: ReactNode; value: number; sub?: string }[]; label: (n: number) => string }) => {
  const { t } = useNaqlaT()
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <Text size="small" className="text-ui-fg-muted">{t("common.noData")}</Text>
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex justify-between gap-3">
            <Text size="small" weight="plus" className="truncate">{r.name}</Text>
            <Text size="small" className="shrink-0 text-ui-fg-subtle">{label(r.value)}{r.sub ? ` · ${r.sub}` : ""}</Text>
          </div>
          <div className="mt-1 h-2 rounded-full bg-ui-bg-component">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: "linear-gradient(90deg, #0E9E9F, #03635E)" }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export const Card = ({ title, children, testid }: { title: ReactNode; children: ReactNode; testid?: string }) => (
  <Container className="px-6 py-4" data-testid={testid}>
    <Heading level="h2" className="mb-3">{title}</Heading>
    {children}
  </Container>
)
