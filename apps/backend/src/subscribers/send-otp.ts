import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * يرسل رمز الدخول عبر قناة واتساب عند توليده في مزوّد phone-auth.
 * M1: الرمز لا يبقى في جدول notification (كان يقرؤه أي مسؤول) — يُخفى فور الإرسال ويبقى سجل «أُرسل رمز».
 */
export default async function sendOtp({ event: { data }, container }: SubscriberArgs<{ phone: string; otp: string }>) {
  const notification = container.resolve(Modules.NOTIFICATION)
  const created: any = await notification.createNotifications({
    to: data.phone,
    channel: "whatsapp",
    template: "otp",
    data: { otp: data.otp },
  })
  const ids = (Array.isArray(created) ? created : [created]).map((n) => n?.id).filter(Boolean)
  try {
    if (ids.length) await (notification as any).updateNotifications(ids.map((id: string) => ({ id, data: { otp: "••••••" } })))
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).warn(`[otp] تعذّر إخفاء الرمز من سجل الإشعار: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "phone-auth.otp.generated" }
