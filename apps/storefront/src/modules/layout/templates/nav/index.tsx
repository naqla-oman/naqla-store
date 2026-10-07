import { Suspense } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import Brand from "@modules/common/components/brand"
import Icon from "@modules/common/components/icon"
import ThemeToggle from "@modules/layout/components/theme-toggle"
import HeaderSearch from "@modules/layout/components/header-search"
import { getFreeShippingOver } from "@lib/data/shipping-threshold"
import LangSwitch from "@modules/layout/components/lang-switch"
import { getCurrencyLabel, getT } from "@/i18n/t"
import { getStoreConfig } from "@/i18n/store-config"

export default async function Nav() {
  const sc = await getStoreConfig()
  const t = await getT("layout")
  const CUR = await getCurrencyLabel()
  // M19: الحد من قاعدة Medusa الفعلية (null = لا توصيل مجاني ← لا يظهر الشريط)
  const freeOver = await getFreeShippingOver()
  return (
    <div className="sticky top-0 inset-x-0 z-50">
      <div className="announce hidden small:flex">
        {freeOver != null && <span><Icon name="truck" size={14} /> {t("freeOver", { amount: `${freeOver} ${CUR}` })}</span>}
        {/* منخفضة: مدة الاستبدال من إعداد العميل (كانت ١٤ ثابتة لكل العملاء) */}
        {sc.seo.returnDays > 0 && <span><Icon name="refresh" size={14} /> {t("exchangeDays", { count: sc.seo.returnDays })}</span>}
        {sc.welcomeCode && (
          <span><Icon name="gift" size={14} /> {sc.welcomeCode.text} {t("withCode", { code: sc.welcomeCode.code })}</span>
        )}
      </div>
      {freeOver != null && <div className="announce small:hidden"><span><Icon name="truck" size={14} /> {t("freeOver", { amount: `${freeOver} ${CUR}` })}</span></div>}
      <header className="hdr">
        <nav className="wrap flex items-center gap-3 h-[66px]" aria-label={t("s31d46b")}>
          <div className="small:hidden"><SideMenu /></div>
          <Brand />
          <div className="hidden small:flex items-center gap-0.5 ms-2 whitespace-nowrap">
            {sc.nav.map((n) => (
              <LocalizedClientLink
                key={n.href}
                href={n.href}
                className={`px-3 py-2 rounded-[10px] text-[14.5px] font-medium hover:text-accent hover:bg-accent-soft ${n.accent ? "text-copper font-bold" : "text-ink-2"}`}
              >
                {n.label}
              </LocalizedClientLink>
            ))}
          </div>
          <HeaderSearch className="!hidden small:!flex ms-auto" />
          <div className="flex items-center gap-2 ms-auto small:ms-0">
            <LocalizedClientLink href="/store?focus=search" className="iconbtn small:!hidden" aria-label={t("sab79fc")}><Icon name="search" /></LocalizedClientLink>
            <ThemeToggle className="!hidden small:!grid" />
            <LangSwitch languages={sc.languages} className="iconbtn langbtn" compact />
            <LocalizedClientLink href="/account/wishlist" className="iconbtn !hidden small:!grid" aria-label={t("s501839")}><Icon name="heart" /></LocalizedClientLink>
            <LocalizedClientLink href="/account" className="iconbtn !hidden small:!grid" aria-label={t("sc0f526")} data-testid="nav-account-link"><Icon name="user" /></LocalizedClientLink>
            <Suspense fallback={<LocalizedClientLink className="iconbtn" href="/cart" aria-label={t("s0c93af")}><Icon name="bag" /></LocalizedClientLink>}>
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
