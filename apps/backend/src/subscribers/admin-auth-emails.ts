import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * H17: «نسيت كلمة المرور» ودعوات المستخدمين — كانت اللوحة تعرض «تم الإرسال» ولا يُرسل شيء.
 * تُرسل عبر قناة email (SendGrid عند ضبطه، وإلا تُكتب في سجل الخادم في التطوير).
 */
type ResetData = { entity_id: string; token: string; actor_type: string }
type InviteData = { id: string }

const adminUrl = () => `${(process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")}/app`

const html = (title: string, body: string, link: string, cta: string) => `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;color:#041B3F">
  <h2 style="color:#03635E">${title}</h2>
  <p>${body}</p>
  <p><a href="${link}" style="display:inline-block;background:#03635E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${cta}</a></p>
  <p style="font-size:12px;color:#666">إن لم تطلب ذلك فتجاهل هذه الرسالة. — لوحة نقلة</p>
</div>`

export default async function adminAuthEmails({ event, container }: SubscriberArgs<ResetData | InviteData>) {
  const notifications = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    if (event.name === "auth.password_reset") {
      const d = event.data as ResetData
      if (d.actor_type !== "user") return // الزبائن يدخلون برمز واتساب لا بكلمة مرور
      const link = `${adminUrl()}/reset-password?token=${encodeURIComponent(d.token)}&email=${encodeURIComponent(d.entity_id)}`
      await notifications.createNotifications({
        to: d.entity_id,
        channel: "email",
        template: "admin-password-reset",
        data: { link },
        content: { subject: "استعادة كلمة مرور لوحة نقلة", html: html("استعادة كلمة المرور", "طُلبت استعادة كلمة مرور حسابك في لوحة نقلة. الرابط صالح لفترة محدودة.", link, "تعيين كلمة مرور جديدة") },
      } as any)
      logger.info(`[admin-email] رابط استعادة كلمة المرور أُرسل إلى ${d.entity_id}`)
    } else if (event.name === "invite.created" || event.name === "invite.resent") {
      const invite = await container.resolve(Modules.USER).retrieveInvite((event.data as InviteData).id)
      const link = `${adminUrl()}/invite?token=${encodeURIComponent(invite.token)}`
      await notifications.createNotifications({
        to: invite.email,
        channel: "email",
        template: "admin-invite",
        data: { link },
        content: { subject: "دعوة للانضمام إلى لوحة نقلة", html: html("دعوة للانضمام", "دُعيت لإدارة المتجر عبر لوحة نقلة.", link, "قبول الدعوة") },
      } as any)
      logger.info(`[admin-email] دعوة أُرسلت إلى ${invite.email}`)
    }
  } catch (e) {
    logger.error(`[admin-email] ${event.name}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: ["auth.password_reset", "invite.created", "invite.resent"] }
