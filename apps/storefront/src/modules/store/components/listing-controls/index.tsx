"use client"

import { g } from "@lib/voice"
import Icon from "@modules/common/components/icon"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useRef, useState } from "react"

/** H9 + H11: حقل البحث (يأخذ التركيز عند الفتح من أيقونة البحث) والترتيب بالعربية */
const SORTS = [
  { value: "created_at", label: "الأحدث" },
  { value: "price_asc", label: "الأقل سعراً" },
  { value: "price_desc", label: "الأعلى سعراً" },
]

export default function ListingControls({ searchAction }: { searchAction: string }) {
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
          placeholder={g("ابحثي عن منتج، لون، أو قسم…", "ابحث عن منتج، لون، أو قسم…")}
          aria-label="بحث في المتجر"
          enterKeyHint="search"
          data-testid="search-input"
        />
      </form>
      <label className="sortsel">
        <span>ترتيب</span>
        <select value={params.get("sortBy") ?? "created_at"} onChange={(e) => sort(e.target.value)} data-testid="sort-select" aria-label="ترتيب المنتجات">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
    </div>
  )
}
