"use client"
import { useEffect, useState } from "react"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "../../../../store.config"
import { useT } from "@/i18n/t"

// مفتاح لكل متجر حتى لا يتشارك متجران على المتصفح نفسه اختيار الوضع
const KEY = `${storeConfig.slug}:theme`

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useT("layout")
  const [dark, setDark] = useState(storeConfig.defaultTheme === "dark")
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      // بلا اختيار محفوظ: الوضع الافتراضي من store.json → defaultTheme
      const isDark = saved ? saved === "dark" : storeConfig.defaultTheme === "dark"
      document.documentElement.dataset.theme = isDark ? "dark" : "light"
      setDark(isDark)
    } catch {}
  }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? "dark" : "light"
    try { localStorage.setItem(KEY, next ? "dark" : "light") } catch {}
  }
  return (
    <button type="button" onClick={toggle} className={`iconbtn ${className}`} aria-label={dark ? t("sadabb7") : t("sccf95e")}>
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  )
}
