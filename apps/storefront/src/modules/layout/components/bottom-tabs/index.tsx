"use client"
import { usePathname, useParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"

const TABS = [
  { href: "/", icon: "home", label: "الرئيسية", match: (p: string) => p === "" || p === "/" },
  { href: "/store", icon: "grid", label: "الأقسام", match: (p: string) => /^\/(store|categories|collections|products)/.test(p) },
  { href: "/cart", icon: "bag", label: "السلة", match: (p: string) => p.startsWith("/cart") },
  { href: "/account/wishlist", icon: "heart", label: "المفضلة", match: (p: string) => p.startsWith("/account/wishlist") },
  { href: "/account", icon: "user", label: "حسابي", match: (p: string) => p.startsWith("/account") && !p.startsWith("/account/wishlist") },
]

export default function BottomTabs({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()
  const p = pathname.replace(`/${countryCode}`, "") || "/"
  if (p.startsWith("/checkout")) return null
  return (
    <nav className="tabs small:hidden" aria-label="التنقل الرئيسي">
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
