"use client"
import Link from "next/link"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { langPrefix } from "@/i18n/config"

/**
 * مبدّل اللغة: يحفظ الصفحة نفسها (المسار والاستعلام) — يظهر فقط للمتجر متعدد اللغات.
 * العربية بلا بادئة، الإنجليزية /en. الكوكي يضبطه الوسيط عند الزيارة.
 */
export default function LangSwitch({ languages, className = "" }: { languages: string[]; className?: string }) {
  const { countryCode, lang } = useParams<{ countryCode: string; lang: string }>()
  const pathname = usePathname(), q = useSearchParams().toString()
  if (languages.length < 2) return null
  const rest = pathname.replace(new RegExp(`^/${countryCode}${langPrefix(lang)}`), "") || "/"
  const target = lang === "en" ? "ar" : "en"
  const href = `/${countryCode}${langPrefix(target)}${rest === "/" ? "" : rest}${q ? `?${q}` : ""}`
  return (
    <Link href={href} hrefLang={target} lang={target} className={`langswitch ${className}`} data-testid="lang-switch" prefetch={false}>
      {target === "en" ? "English" : "العربية"}
    </Link>
  )
}
