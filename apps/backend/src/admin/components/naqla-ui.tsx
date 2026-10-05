import { Container, Heading, Text } from "@medusajs/ui"
import { ReactNode, useEffect, useState } from "react"

/** أدوات مشتركة لصفحات قسم «نقلة» في اللوحة */
export function useNaqla<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch(path, { credentials: "include" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`); return j })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [path])
  return { data, error }
}

export const money = (n: number, label = "") =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)}${label ? ` ${label}` : ""}`

export const PageHead = ({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) => (
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

/** شريط أفقي لكل عنصر بنسبة من الأكبر */
export const BarList = ({ rows, label }: { rows: { name: string; value: number; sub?: string }[]; label: (n: number) => string }) => {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <Text size="small" className="text-ui-fg-muted">لا بيانات بعد</Text>
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.name}>
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

export const Card = ({ title, children, testid }: { title: string; children: ReactNode; testid?: string }) => (
  <Container className="px-6 py-4" data-testid={testid}>
    <Heading level="h2" className="mb-3">{title}</Heading>
    {children}
  </Container>
)
