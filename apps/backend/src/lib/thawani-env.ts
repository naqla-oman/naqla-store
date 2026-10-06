import { thawaniCreds } from "./credentials"

/**
 * M12: ثواني متاح عند وجود مفتاحيه (من «إعدادات المتجر» ← الدفع والتواصل، أو .env) —
 * مصدر واحد لمزامنة مزوّدي المنطقة والتحقق من تفعيل الميزة.
 */
export const thawaniConfigured = () => {
  const c = thawaniCreds()
  return !!c.secretKey && !!c.publishableKey
}
