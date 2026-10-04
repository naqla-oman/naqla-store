/* eslint-disable @next/next/no-img-element */
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clientAsset, storeConfig } from "../../../../store.config"

const B = storeConfig.brand

/** علامة الهوية المربعة (للأيقونات والشعار غير الكلمة) */
export function LogoMark({ className = "" }: { className?: string }) {
  return <img src={clientAsset(B.logo)} alt="" aria-hidden="true" className={`block rounded-[11px] ${className}`} />
}

/**
 * شعار المتجر في الهيدر والفوتر:
 * - wordmark: ملف الشعار يحوي الكلمة كاملة → يُعرض وحده، بنسخة ليلية وأخرى للأرضية الداكنة
 * - غير ذلك: العلامة المربعة + الاسم القصير + الاسم اللاتيني نصاً
 */
export default function Brand({ dark = false }: { dark?: boolean }) {
  if (B.wordmark) {
    return (
      <LocalizedClientLink href="/" className="brand-word shrink-0" aria-label={storeConfig.name}>
        {dark ? (
          <img src={clientAsset(B.logoOnDark)} alt={storeConfig.name} className="h-[44px] w-auto" />
        ) : (
          <>
            <img src={clientAsset(B.logo)} alt={storeConfig.name} className="logo-light h-[44px] w-auto" />
            <img src={clientAsset(B.logoDark)} alt="" aria-hidden="true" className="logo-dark h-[44px] w-auto" />
          </>
        )}
      </LocalizedClientLink>
    )
  }
  return (
    <LocalizedClientLink href="/" className="flex items-center gap-2.5 shrink-0" aria-label={storeConfig.name}>
      <LogoMark className="w-[38px] h-[38px]" />
      <span className={`font-display font-extrabold text-[24px] leading-none flex flex-col ${dark ? "text-footer-ink" : "text-ink"}`}>
        {storeConfig.shortName}
        <small className={`font-body font-medium text-[9px] tracking-[2.6px] mt-[3px] ${dark ? "text-footer-muted" : "text-muted"}`}>
          {storeConfig.nameEn.toUpperCase()}
        </small>
      </span>
    </LocalizedClientLink>
  )
}
