/* eslint-disable @next/next/no-img-element */
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clientAsset, storeConfig } from "../../../../store.config"
import { useStoreConfig } from "@/i18n/store-config"

// الشعار يُقرأ عند الرسم (يتغير من «إعدادات المتجر» ← الهوية)
const brand = () => storeConfig.brand

/** علامة الهوية المربعة (للأيقونات والشعار غير الكلمة) */
export function LogoMark({ className = "" }: { className?: string }) {
  const sc = useStoreConfig()
  return <img src={clientAsset(brand().logo)} alt="" aria-hidden="true" className={`block rounded-[11px] ${className}`} />
}

/**
 * شعار المتجر في الهيدر والفوتر:
 * - wordmark: ملف الشعار يحوي الكلمة كاملة → يُعرض وحده، بنسخة ليلية وأخرى للأرضية الداكنة
 * - غير ذلك: العلامة المربعة + الاسم القصير + الاسم اللاتيني نصاً
 */
export default function Brand({ dark = false }: { dark?: boolean }) {
  const sc = useStoreConfig()
  if (brand().wordmark) {
    return (
      <LocalizedClientLink href="/" className="brand-word shrink-0" aria-label={sc.name}>
        {dark ? (
          <img src={clientAsset(brand().logoOnDark)} alt={sc.name} className="h-[44px] w-auto" />
        ) : (
          <>
            <img src={clientAsset(brand().logo)} alt={sc.name} className="logo-light h-[44px] w-auto" />
            <img src={clientAsset(brand().logoDark)} alt="" aria-hidden="true" className="logo-dark h-[44px] w-auto" />
          </>
        )}
      </LocalizedClientLink>
    )
  }
  return (
    <LocalizedClientLink href="/" className="flex items-center gap-2.5 shrink-0" aria-label={sc.name}>
      <LogoMark className="w-[38px] h-[38px]" />
      <span className={`font-display font-extrabold text-[24px] leading-none flex flex-col ${dark ? "text-footer-ink" : "text-ink"}`}>
        {sc.shortName}
        <small className={`font-body font-medium text-[9px] tracking-[2.6px] mt-[3px] ${dark ? "text-footer-muted" : "text-muted"}`}>
          {sc.nameEn.toUpperCase()}
        </small>
      </span>
    </LocalizedClientLink>
  )
}
