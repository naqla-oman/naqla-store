"use client"
import { useEffect, useState } from "react"
import Icon from "@modules/common/components/icon"

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme")
      if (saved === "dark") { document.documentElement.dataset.theme = "dark"; setDark(true) }
    } catch {}
  }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? "dark" : "light"
    try { localStorage.setItem("theme", next ? "dark" : "light") } catch {}
  }
  return (
    <button type="button" onClick={toggle} className={`iconbtn ${className}`} aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}>
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  )
}
