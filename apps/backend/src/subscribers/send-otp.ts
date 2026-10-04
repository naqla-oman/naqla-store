import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

/** يرسل رمز الدخول عبر قناة واتساب عند توليده في مزوّد phone-auth */
export default async function sendOtp({ event: { data }, container }: SubscriberArgs<{ phone: string; otp: string }>) {
  const notification = container.resolve(Modules.NOTIFICATION)
  await notification.createNotifications({
    to: data.phone,
    channel: "whatsapp",
    template: "otp",
    data: { otp: data.otp },
  })
}

export const config: SubscriberConfig = { event: "phone-auth.otp.generated" }
