import { formatAmount } from "@lib/util/money"
import { useCurrencyLabel } from "@/i18n/t"

/** مبلغ بالريال: الرقم بخط عريض والوحدة أصغر — 28.500 ر.ع (أو OMR بالإنجليزية) */
export default function Money({ amount, className = "price" }: { amount: number; className?: string }) {
  const label = useCurrencyLabel()
  return (
    <span className={className}>
      {formatAmount(amount)}
      <small>{label}</small>
    </span>
  )
}
