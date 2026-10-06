"use client"

import Icon from "@modules/common/components/icon"
import { useState } from "react"
import { useT } from "@/i18n/t"

/** مشاركة المنتج: قائمة المشاركة على الجوال، ونسخ الرابط على الحاسوب */
export default function ShareButton({ title }: { title: string }) {
  const t = useT("product")
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* أُلغيت المشاركة */
    }
  }

  return (
    <button type="button" className="iconbtn share" onClick={share} aria-label={copied ? t("s005a34") : t("s81a50c")} title={copied ? t("s005a34") : t("s81a50c")}>
      <Icon name={copied ? "check" : "share"} size={18} />
    </button>
  )
}
