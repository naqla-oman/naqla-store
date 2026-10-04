"use client"

import Icon from "@modules/common/components/icon"
import { useState } from "react"

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="copybtn"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) } catch {}
      }}
    >
      <Icon name={done ? "check" : "box"} size={14} /> {done ? "تم النسخ" : "نسخ"}
    </button>
  )
}
