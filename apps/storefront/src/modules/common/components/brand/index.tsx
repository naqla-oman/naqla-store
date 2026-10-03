import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { storeConfig } from "../../../../store.config"

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-[11px] bg-accent text-accent-ink ${className}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className="w-[68%] h-[68%]">
        <path d="M41 13v25c0 7.2-5.8 13-13 13h-9" fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 22l4.5 4.5L19 31l-4.5-4.5z" fill="var(--copper)" />
      </svg>
    </span>
  )
}

export default function Brand({ dark = false }: { dark?: boolean }) {
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
