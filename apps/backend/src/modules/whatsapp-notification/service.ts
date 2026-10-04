import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"

type Options = {
  /** true عند توفر حساب WhatsApp Business (Meta Cloud API) */
  enabled?: boolean
  accessToken?: string
  phoneNumberId?: string
  /** اسم قالب المصادقة المعتمد في Meta (فئة Authentication) */
  otpTemplate?: string
  language?: string
  apiVersion?: string
}

/**
 * إرسال رسائل واتساب عبر Meta WhatsApp Cloud API.
 * - template "otp": قالب مصادقة معتمد مع زر نسخ الرمز
 * - بدون حساب (enabled=false): يكتب الرمز في سجل الخادم أثناء التطوير فقط، ويرفض الإرسال في الإنتاج
 */
class WhatsappNotificationService extends AbstractNotificationProviderService {
  static identifier = "whatsapp"

  protected options_: Options
  protected logger_: Logger

  static validateOptions(options: Record<string, unknown>) {
    if (options.enabled && (!options.accessToken || !options.phoneNumberId || !options.otpTemplate)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WhatsApp: WHATSAPP_ACCESS_TOKEN و WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_OTP_TEMPLATE مطلوبة عند التفعيل"
      )
    }
  }

  constructor({ logger }: { logger: Logger }, options: Options) {
    super()
    this.logger_ = logger
    this.options_ = { language: "ar", apiVersion: "v21.0", ...options }
  }

  async send(n: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const to = String(n.to).replace(/\D/g, "")
    const data = (n.data ?? {}) as Record<string, string>

    if (!this.options_.enabled) {
      if (process.env.NODE_ENV === "production") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "WhatsApp غير مفعّل — لا يمكن إرسال الرمز")
      }
      this.logger_.info(`[whatsapp:dev] ${n.template} → +${to}${data.otp ? ` رمز الدخول: ${data.otp}` : ""}`)
      return { id: `dev-${Date.now()}` }
    }

    if (n.template !== "otp" || !data.otp) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `WhatsApp: قالب غير مدعوم ${n.template}`)
    }

    const res = await fetch(
      `https://graph.facebook.com/${this.options_.apiVersion}/${this.options_.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options_.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: this.options_.otpTemplate,
            language: { code: this.options_.language },
            components: [
              { type: "body", parameters: [{ type: "text", text: data.otp }] },
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: data.otp }] },
            ],
          },
        }),
      }
    )
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } }
    if (!res.ok) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `WhatsApp: ${json.error?.message ?? res.status}`)
    }
    return { id: json.messages?.[0]?.id }
  }
}

export default WhatsappNotificationService
