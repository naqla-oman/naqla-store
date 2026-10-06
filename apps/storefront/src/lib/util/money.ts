import { isEmpty } from "./isEmpty"
import { storeConfig } from "../../store.config"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

/** يعرض المبالغ بالصيغة العُمانية: 28.500 ر.ع (أرقام لاتينية، ثلاث منازل) */
export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = "en-US",
}: ConvertToLocaleParams) => {
  if (!currency_code || isEmpty(currency_code)) return amount.toString()
  if (currency_code.toLowerCase() === storeConfig.currency) {
    const n = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minimumFractionDigits ?? 3,
      maximumFractionDigits: maximumFractionDigits ?? 3,
    }).format(amount)
    return `${n} ${String(locale).startsWith("ar") ? storeConfig.currencyLabel : storeConfig.currency.toUpperCase()}`
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency_code,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount)
}

/** الرقم فقط بثلاث منازل (للعرض مع وحدة العملة بخط أصغر) */
export const formatAmount = (amount: number, digits = 3) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
