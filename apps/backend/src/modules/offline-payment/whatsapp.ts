import { OfflinePaymentProvider } from "./base"

/** إرسال الطلب عبر واتساب — يُسجَّل الطلب ويُؤكَّد الدفع مع الزبونة على واتساب */
export class WhatsappPaymentProvider extends OfflinePaymentProvider {
  static identifier = "whatsapp"
  protected method = "whatsapp"
}
