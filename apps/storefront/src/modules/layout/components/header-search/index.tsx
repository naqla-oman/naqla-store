"use client"
import { useRouter, useParams } from "next/navigation"
import { useState } from "react"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "../../../../store.config"

export default function HeaderSearch({ className = "" }: { className?: string }) {
  const [q, setQ] = useState("")
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  return (
    <form
      className={`hsearch ${className}`}
      role="search"
      onSubmit={(e) => { e.preventDefault(); router.push(`/${countryCode}/store?q=${encodeURIComponent(q.trim())}`) }}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={storeConfig.searchPlaceholder}
        aria-label="بحث"
        autoComplete="off"
      />
      <button type="submit" aria-label="بحث"><Icon name="search" size={18} /></button>
    </form>
  )
}
