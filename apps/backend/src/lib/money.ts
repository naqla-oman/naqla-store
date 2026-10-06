/**
 * منخفضة: أرقام Medusa قد تعود BigNumber (Number() ← NaN) أو بكسور عائمة (19.714285714285715).
 * num: قيمة رقمية آمنة. round: تقريب لدقة العملة (الريال 3 منازل، وغيره حسب Intl).
 */
export const num = (v: any): number => {
  if (v == null) return 0
  const n = Number(typeof v === "object" ? v.numeric ?? v.value ?? v.toString?.() : v)
  return Number.isFinite(n) ? n : 0
}

const DECIMALS: Record<string, number> = { omr: 3, kwd: 3, bhd: 3, jod: 3 }
export const decimalsOf = (currency?: string) =>
  DECIMALS[String(currency ?? "").toLowerCase()] ??
  (new Intl.NumberFormat("en", { style: "currency", currency: String(currency || "usd").toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2)

export const round = (v: any, currency?: string) => {
  const d = decimalsOf(currency)
  return Math.round(num(v) * 10 ** d) / 10 ** d
}
