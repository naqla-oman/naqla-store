import { formatAmount } from "@lib/util/money"
import { storeConfig } from "../../../../store.config"

/** مبلغ بالريال: الرقم بخط عريض والوحدة أصغر — 28.500 ر.ع */
export default function Money({ amount, className = "price" }: { amount: number; className?: string }) {
  return (
    <span className={className}>
      {formatAmount(amount)}
      <small>{storeConfig.currencyLabel}</small>
    </span>
  )
}
