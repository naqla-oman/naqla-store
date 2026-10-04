import { OfflinePaymentProvider } from "./base"

/** الدفع عند الاستلام — نقداً أو ببطاقة عند وصول المندوب */
export class CodPaymentProvider extends OfflinePaymentProvider {
  static identifier = "cod"
  protected method = "cod"
}
