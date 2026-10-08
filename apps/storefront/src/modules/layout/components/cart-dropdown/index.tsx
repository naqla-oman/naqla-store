"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import CartLines from "@modules/cart/templates/lines"
import { usePathname } from "next/navigation"
import Icon from "@modules/common/components/icon"
import { Fragment, useEffect, useRef, useState } from "react"
import { cartPayable } from "@lib/util/cart-totals"
import { useT } from "@/i18n/t"

/**
 * سلة الرأس (الكمبيوتر): أسطر السلة نفسها التي في صفحة السلة (الاسم والخيار المترجمان، الكمية، الإزالة)،
 * والإجمالي بالحساب نفسه (أسعار شاملة الضريبة) — كان يعرض cart.subtotal (قبل الضريبة) فيخالف سعر السطر.
 */
const CartDropdown = ({ cart }: { cart?: HttpTypes.StoreCart | null }) => {
  const t = useT("cart")
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const items = cart?.items ?? []
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)
  const prev = useRef(totalItems)
  const pathname = usePathname()

  const show = (ms?: number) => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
    if (ms) timer.current = setTimeout(() => setOpen(false), ms)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // تُفتح لحظياً بعد إضافة منتج (خارج صفحتي السلة والدفع)
  useEffect(() => {
    // لا تُفتح فوق العرض السريع (رسالته تكفي هناك)
    if (totalItems > prev.current && !/\/(cart|checkout)/.test(pathname) && !document.querySelector("[data-testid=quick-view]")) show(5000)
    prev.current = totalItems
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems])

  return (
    <div className="h-full z-50" onMouseEnter={() => show()} onMouseLeave={hide}>
      <Popover className="relative h-full">
        {/* M28: عنصر عادي — القائمة تُفتح بالمرور؛ PopoverButton كـ div كان يحمل aria-expanded غير المسموح */}
        <div className="h-full flex items-center">
          <LocalizedClientLink className="iconbtn" href="/cart" data-testid="nav-cart-link" aria-label={t("cartAria", { n: totalItems })}>
            <Icon name="bag" />
            {totalItems > 0 && <span className="badge">{totalItems}</span>}
          </LocalizedClientLink>
        </div>
        <Transition
          show={open}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel static className="cartdrop hidden small:flex" data-testid="nav-cart-dropdown">
            <div className="cdhead">
              <h3>{t("sacf86f")}</h3>
              {totalItems > 0 && <span className="muted">{t("piecesCount", { count: totalItems })}</span>}
            </div>
            {items.length ? (
              <>
                <div className="cdlines">
                  <CartLines items={items} />
                </div>
                <div className="cdfoot">
                  <div className="trow final">
                    <span>{t("s7512af")} <small className="muted">{t("s453f5c")}</small></span>
                    <span data-testid="cart-subtotal" data-value={cartPayable(cart!)}><Money amount={cartPayable(cart!)} className="" /></span>
                  </div>
                  <div className="cdbtns">
                    <LocalizedClientLink href="/cart" className="btn ghost" onClick={hide} data-testid="go-to-cart-button">{t("viewCart")}</LocalizedClientLink>
                    <LocalizedClientLink href="/checkout" className="btn" onClick={hide}>{t("se4d013")} <Icon name="arrowL" size={16}/></LocalizedClientLink>
                  </div>
                </div>
              </>
            ) : (
              <div className="cdempty">
                <Icon name="bag" size={36} />
                <p>{t("s51f5b1")}</p>
                <LocalizedClientLink href="/store" className="btn" onClick={hide}>{t("s43552d")}</LocalizedClientLink>
              </div>
            )}
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}

export default CartDropdown
