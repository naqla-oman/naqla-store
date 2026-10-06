import PrivacyLink from "@modules/common/components/privacy-link"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Brand from "@modules/common/components/brand"
import Icon from "@modules/common/components/icon"
import BottomTabs from "@modules/layout/components/bottom-tabs"
import Decor from "@modules/common/components/decor"
import { storeConfig as c } from "../../../../store.config"
import { g } from "@lib/voice"

const COLS = [
  { title: g("تسوّقي", "تسوّق"), links: c.nav.map((n) => ({ label: n.label, href: n.href })) },
  { title: "خدمة العملاء", links: [
    { label: "تتبّع طلبك", href: "/track" },
    { label: "سياسة الاستبدال والإرجاع", href: "/pages/returns" },
    ...(c.features.sizeGuide ? [{ label: "دليل المقاسات", href: "/pages/size-guide" }] : []),
    { label: "الأسئلة الشائعة", href: "/pages/faq" },
  ] },
  { title: `عن ${c.shortName}`, links: [
    { label: "قصتنا", href: "/pages/about" },
    { label: "فروعنا", href: "/pages/stores" },
    ...(c.features.loyalty ? [{ label: "برنامج الولاء", href: "/account" }] : []),
    ...(c.features.gift ? [{ label: "بطاقات الهدايا", href: "/store?q=هدية" }] : []),
  ] },
]

export default function Footer() {
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
              <h4>{g("تواصلي معنا", "تواصل معنا")}</h4>
              <div><Icon name="pin" size={16} /><span><b>{c.contact.address}</b>{c.contact.hours}</span></div>
              <div><Icon name="phone" size={16} /><span><b dir="ltr">{c.contact.phone}</b>{c.contact.email}</span></div>
              <a href={`https://wa.me/${c.contact.whatsapp}`} target="_blank" rel="noreferrer" className="btn wa sm mt-2"><Icon name="whatsapp" size={16} /> راسلينا على واتساب</a>
            </div>
          </div>
          <div className="fpay">
            <span>طرق دفع آمنة ومتنوعة</span>
            <div className="logos">
              {/* M12: شعار ثواني فقط إن كان مفعّلاً */}
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              {c.checkout.payments.some((p) => p.key === "thawani") && <span><img src="/img/pay/thawani.png" alt="" /> ثواني</span>}
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              <span><img src="/img/pay/visa.svg" alt="Visa" /></span>
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              <span><img src="/img/pay/mastercard.svg" alt="Mastercard" /></span>
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
              <span><img src="/img/pay/applepay.svg" alt="Apple Pay" /></span>
              <span><Icon name="cash" size={14} /> الدفع عند الاستلام</span>
            </div>
            <span><Icon name="truck" size={14} className="me-1" /> توصيل لكل محافظات السلطنة خلال 24–48 ساعة</span>
          </div>
          <div className="fbottom">
            <span>© {new Date().getFullYear()} {c.name} — جميع الحقوق محفوظة.</span>
            {(c.legal.cr || c.legal.vat) && (
              <span data-testid="footer-legal">
                {c.legal.cr && <>السجل التجاري: <bdi>{c.legal.cr}</bdi></>}
                {c.legal.cr && c.legal.vat && " · "}
                {c.legal.vat && <>الرقم الضريبي: <bdi>{c.legal.vat}</bdi></>}
              </span>
            )}
            <PrivacyLink />
            <span className="flex gap-4"><LocalizedClientLink href="/pages/terms">الشروط والأحكام</LocalizedClientLink><LocalizedClientLink href="/pages/privacy">سياسة الخصوصية</LocalizedClientLink></span>
            <span>صُنع بشغف بواسطة <a href={c.builtBy.url} target="_blank" rel="noreferrer"><b>{c.builtBy.name}</b></a></span>
          </div>
        </div>
        <Decor className="wrap" />
      </footer>
      <BottomTabs />
    </>
  )
}
