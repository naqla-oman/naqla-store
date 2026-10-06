"use client"

import Icon from "@modules/common/components/icon"
import { useState } from "react"
import { useT } from "@/i18n/t"

export default function CopyButton({ text }: { text: string }) {
  const t = useT("order")
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="copybtn"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) } catch {}
      }}
    >
      <Icon name={done ? "check" : "box"} size={14} /> {done ? t("s49f121") : t("seb32f7")}
    </button>
  )
}
