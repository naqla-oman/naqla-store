import { storeConfig } from "../../store.config"

/**
 * M15: الضريبة المضمَّنة في الإجمالي (الأسعار شاملة). من Medusa (tax_total) إن حُسبت،
 * وإلا من المعدل: الإجمالي × ر ÷ (100 + ر).
 */
export function includedTax(total: number, taxTotal?: number | null) {
  const rate = storeConfig.taxRate ?? 5
  const fromMedusa = Number(taxTotal ?? 0)
  return { rate, amount: fromMedusa > 0 ? fromMedusa : rate > 0 ? (total * rate) / (100 + rate) : 0 }
}
