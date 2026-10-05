"use client"

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react"
import { Fragment } from "react"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import { LogoMark } from "@modules/common/components/brand"
import { storeConfig } from "../../../../store.config"

const EXTRA = [
  { label: "تتبّع طلبك", href: "/account/orders", icon: "truck" },
  { label: "حسابي", href: "/account", icon: "user" },
  { label: "المفضلة", href: "/account/wishlist", icon: "heart" },
]

const SideMenu = () => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  return (
    <Popover className="h-full flex">
      {({ open, close }) => (
        <>
          <PopoverButton className="iconbtn" aria-label="القائمة" data-testid="nav-menu-button">
            <Icon name="menu" />
          </PopoverButton>
          {open && <div className="fixed inset-0 z-[50] bg-black/40" onClick={close} />}
          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-x-6 rtl:translate-x-6"
            enterTo="opacity-100 translate-x-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-x-0"
            leaveTo="opacity-0 -translate-x-6 rtl:translate-x-6"
          >
            <PopoverPanel className="fixed inset-y-0 start-0 z-[51] w-[86%] max-w-[360px] bg-surface shadow-card flex flex-col rounded-e-lg2">
              <div className="flex items-center gap-3 p-4 border-b border-line">
                <LogoMark className="w-9 h-9" />
                <b className="font-display text-lg">{storeConfig.shortName}</b>
                <button onClick={close} className="iconbtn ms-auto" aria-label="إغلاق"><Icon name="x" /></button>
              </div>
              {/* H9: بحث في القائمة الجانبية (الجوال) */}
              <form
                role="search"
                className="searchbox m-3 mb-0"
                onSubmit={(e) => {
                  e.preventDefault()
                  const q = String(new FormData(e.currentTarget).get("q") ?? "").trim()
                  close()
                  router.push(`/${countryCode}/store${q ? `?q=${encodeURIComponent(q)}` : ""}`)
                }}
              >
                <Icon name="search" size={18} />
                <input type="search" name="q" placeholder="ابحث في المتجر…" aria-label="بحث في المتجر" enterKeyHint="search" data-testid="menu-search" />
              </form>
              <ul className="p-3 flex flex-col gap-1 overflow-y-auto">
                {storeConfig.nav.map((n) => (
                  <li key={n.href}>
                    <LocalizedClientLink
                      href={n.href}
                      onClick={close}
                      className={`flex items-center justify-between px-4 h-12 rounded-sm2 text-[15px] font-medium hover:bg-accent-soft ${n.accent ? "text-copper font-bold" : "text-ink"}`}
                    >
                      {n.label}
                      <Icon name="chevL" size={16} className="text-muted" />
                    </LocalizedClientLink>
                  </li>
                ))}
                <li className="my-2 border-t border-line" />
                {EXTRA.map((n) => (
                  <li key={n.href}>
                    <LocalizedClientLink href={n.href} onClick={close} className="flex items-center gap-3 px-4 h-12 rounded-sm2 text-[14.5px] text-ink-2 hover:bg-accent-soft">
                      <Icon name={n.icon} size={18} className="text-accent" />
                      {n.label}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
              <div className="mt-auto p-4 border-t border-line">
                <a href={`https://wa.me/${storeConfig.contact.whatsapp}`} target="_blank" rel="noreferrer" className="btn wa block">
                  <Icon name="whatsapp" size={18} /> راسلينا على واتساب
                </a>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}

export default SideMenu
