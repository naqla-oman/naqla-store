import PrivacyLink from "@modules/common/components/privacy-link"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Brand from "@modules/common/components/brand"
import Icon from "@modules/common/components/icon"
import BottomTabs from "@modules/layout/components/bottom-tabs"
import Decor from "@modules/common/components/decor"
import { useStoreConfig } from "@/i18n/store-config"
import type { StoreConfig } from "../../../../store.config"
import { g } from "@lib/voice"
import LangSwitch from "@modules/layout/components/lang-switch"
import { useT } from "@/i18n/t"

type T = (k: string, v?: Record<string, string | number>) => string
const colsOf = (t: T, c: StoreConfig) => [
  { title: t("s82d4b8"), links: c.nav.map((n) => ({ label: n.label, href: n.href })) },
  { title: t("sbf40d0"), links: [
    { label: t("s9241c5"), href: "/track" },
    { label: t("sebc58d"), href: "/pages/returns" },
    ...(c.features.sizeGuide ? [{ label: t("s7cde0a"), href: "/pages/size-guide" }] : []),
    { label: t("s53036f"), href: "/pages/faq" },
  ] },
  { title: t("about", { store: c.shortName }), links: [
    { label: t("sbfb6c2"), href: "/pages/about" },
    { label: t("s66088a"), href: "/pages/stores" },
    ...(c.features.loyalty ? [{ label: t("sd6c6c1"), href: "/account" }] : []),
    ...(c.features.gift ? [{ label: t("s836c27"), href: "/store?q=هدية" /* i18n-ok: استعلام بحث في الكتالوج */ }] : []),
  ] },
]

export default function Footer() {
  const t = useT("layout")
  const c = useStoreConfig()
  const COLS = colsOf(t, c)
  return (
    <>
      <footer className="site">
        <div className="wrap">
          <div className="ftop">
            <div className="fbrand">
              <Brand dark />
              <p>{c.description}</p>
              <div className="social">
                <a href={c.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Icon name="instagram" size={18} /></a>
                <a href={c.social.snapchat} target="_blank" rel="noreferrer" aria-label="Snapchat"><Icon name="snap" size={18} /></a>
                <a href={c.social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok"><Icon name="tiktok" size={18} /></a>
                <a href={`https://wa.me/${c.contact.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" size={18} /></a>
              </div>
            </div>
            {COLS.map((col) => (
              <div className="fcol" key={col.title}>
                <details className="small:hidden">
                  <summary>{col.title}</summary>
                  <ul>{col.links.map((l) => <li key={l.href}><LocalizedClientLink href={l.href}>{l.label}</LocalizedClientLink></li>)}</ul>
                </details>
                <div className="hidden small:block">
                  <h4>{col.title}</h4>
                  <ul>{col.links.map((l) => <li key={l.href}><LocalizedClientLink href={l.href}>{l.label}</LocalizedClientLink></li>)}</ul>
                </div>
              </div>
            ))}
            <div className="fcontact">
              <h4>{t("s34a9aa")}</h4>
              <div><Icon name="pin" size={16} /><span><b>{c.contact.address}</b>{c.contact.hours}</span></div>
              <div><Icon name="phone" size={16} /><span><b dir="ltr">{c.contact.phone}</b>{c.contact.email}</span></div>
              <a href={`https://wa.me/${c.contact.whatsapp}`} target="_blank" rel="noreferrer" className="btn wa sm mt-2"><Icon name="whatsapp" size={16} /> {t("sc50746")}</a>
            </div>
          </div>
          <div className="fpay">
            <span>{t("s4f6838")}</span>
            <div className="logos">
              {/* M12: شعار ثواني فقط إن كان مفعّلاً */}
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              {c.checkout.payments.some((p) => p.key === "thawani") && <span><img src="/img/pay/thawani.png" alt="" /> {t("s748343")}</span>}
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              <span><img src="/img/pay/visa.svg" alt="Visa" /></span>
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              <span><img src="/img/pay/mastercard.svg" alt="Mastercard" /></span>
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              <span><img src="/img/pay/applepay.svg" alt="Apple Pay" /></span>
              <span><Icon name="cash" size={14} /> {t("sa4fca7")}</span>
            </div>
            <span><Icon name="truck" size={14} className="me-1" /> {t("s94f8ec")}</span>
          </div>
          <div className="fbottom">
            <LangSwitch languages={c.languages} />
            <span>© {new Date().getFullYear()} {c.name} — {t("rights")}</span>
            {(c.legal.cr || c.legal.vat) && (
              <span data-testid="footer-legal">
                {c.legal.cr && <>{t("sf87d3e")} <bdi>{c.legal.cr}</bdi></>}
                {c.legal.cr && c.legal.vat && " · "}
                {c.legal.vat && <>{t("s7f8e5a")} <bdi>{c.legal.vat}</bdi></>}
              </span>
            )}
            <PrivacyLink />
            <span className="flex gap-4"><LocalizedClientLink href="/pages/terms">{t("s862d75")}</LocalizedClientLink><LocalizedClientLink href="/pages/privacy">{t("se43dd2")}</LocalizedClientLink></span>
            <span>{t("s107b8c")} <a href={c.builtBy.url} target="_blank" rel="noreferrer"><b>{t("naqlaName")}</b></a></span>
          </div>
        </div>
        <Decor className="wrap" />
      </footer>
      <BottomTabs />
    </>
  )
}
