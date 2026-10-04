import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clientAsset, storeConfig } from "../../../../store.config"

/** شعار العميل: clients/<STORE>/logo.svg (مربع الهوية بألوانه) */
export function LogoMark({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={clientAsset("logo.svg")} alt="" aria-hidden="true" className={`block rounded-[11px] ${className}`} />
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
