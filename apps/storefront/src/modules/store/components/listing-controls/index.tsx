"use client"

import { g } from "@lib/voice"
import Icon from "@modules/common/components/icon"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useRef, useState } from "react"
import { useT } from "@/i18n/t"

/** H9 + H11: حقل البحث (يأخذ التركيز عند الفتح من أيقونة البحث) والترتيب بالعربية */
type T = (k: string, v?: Record<string, string | number>) => string
const sortsOf = (t: T) => [
  { value: "created_at", label: t("s55ae35") },
  { value: "price_asc", label: t("sfb15f1") },
  { value: "price_desc", label: t("s52a27a") },
]

export default function ListingControls({ searchAction }: { searchAction: string }) {
  const t = useT("store")
  const SORTS = sortsOf(t)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState(params.get("q") ?? "")

  useEffect(() => {
    if (params.get("focus") === "search") input.current?.focus()
  }, [params])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `${searchAction}?q=${encodeURIComponent(term)}` : searchAction)
  }
  const sort = (value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set("sortBy", value)
    next.delete("page")
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="listctl">
      <form role="search" onSubmit={submit} className="searchbox" action={searchAction}>
        <Icon name="search" size={18} />
        <input
          ref={input}
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("sb1d634")}
          aria-label={t("s45511c")}
          enterKeyHint="search"
          data-testid="search-input"
        />
      </form>
      <label className="sortsel">
        <span>{t("s115428")}</span>
        <select value={params.get("sortBy") ?? "created_at"} onChange={(e) => sort(e.target.value)} data-testid="sort-select" aria-label={t("scb4068")}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
    </div>
  )
}
