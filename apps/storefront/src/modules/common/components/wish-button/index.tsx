"use client"

import { useWishlist } from "@lib/context/wishlist"
import Icon from "@modules/common/components/icon"
import { g } from "@lib/voice"
import { useT } from "@/i18n/t"

/** زر القلب — يعمل داخل بطاقة المنتج (يمنع فتح الرابط) وفي صفحة المنتج */
export default function WishButton({ productId, className = "wish", size = 17 }: { productId: string; className?: string; size?: number }) {
  const t = useT("product")
  const { has, toggle } = useWishlist()
  const on = has(productId)
  return (
    <button
      type="button"
      className={`${className} ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={on ? t("s62ed50") : t("s32afa0")}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(productId) }}
    >
      <Icon name="heart" size={size} className={on ? "fill-current" : ""} />
    </button>
  )
}
