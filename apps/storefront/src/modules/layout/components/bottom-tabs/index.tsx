"use client"
import { usePathname, useParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import { langPrefix } from "@/i18n/config"
import { useT } from "@/i18n/t"

type T = (k: string, v?: Record<string, string | number>) => string
const tabsOf = (t: T) => [
  { href: "/", icon: "home", label: t("s3aa857"), match: (p: string) => p === "" || p === "/" },
  { href: "/store", icon: "grid", label: t("sc6386f"), match: (p: string) => /^\/(store|categories|collections|products)/.test(p) },
  { href: "/cart", icon: "bag", label: t("s0c93af"), match: (p: string) => p.startsWith("/cart") },
  { href: "/account/wishlist", icon: "heart", label: t("s501839"), match: (p: string) => p.startsWith("/account/wishlist") },
  { href: "/account", icon: "user", label: t("sc0f526"), match: (p: string) => p.startsWith("/account") && !p.startsWith("/account/wishlist") },
]

export default function BottomTabs({ cartCount = 0 }: { cartCount?: number }) {
  const t = useT("layout")
  const TABS = tabsOf(t)
  const pathname = usePathname()
  const { countryCode, lang } = useParams<{ countryCode: string; lang: string }>()
  const p = pathname.replace(`/${countryCode}${langPrefix(lang)}`, "") || "/"
  if (p.startsWith("/checkout")) return null
  return (
    <nav className="tabs small:hidden" aria-label={t("se2cbe9")}>
      {TABS.map((t) => {
        const on = t.match(p)
        return (
          <LocalizedClientLink key={t.href} href={t.href} className={`navbtn ${on ? "on" : ""}`}>
            <span className="relative">
              <Icon name={t.icon} size={22} />
              {t.icon === "bag" && cartCount > 0 && <span className="badge">{cartCount}</span>}
            </span>
            {t.label}
          </LocalizedClientLink>
        )
      })}
    </nav>
  )
}
