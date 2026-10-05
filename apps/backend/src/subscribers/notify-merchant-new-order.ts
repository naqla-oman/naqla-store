import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { build } from "../lib/order-notifications"
import { client } from "../lib/client"
import { orderNumber } from "../lib/store-data"

/**
 * M14: تنبيه التاجر بطلب جديد —
 *  1) جرس لوحة نقلة (قناة feed، يعمل فوراً)
 *  2) واتساب لأرقام التاجر الشخصية في store.json → merchantPhones (بعد اعتماد قالب merchant_new_order)
 */
const PAY: Record<string, string> = { cod: "عند الاستلام", thawani: "ثواني (مدفوع)", whatsapp: "عبر واتساب" }

export default async function notifyMerchant({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { data: rows } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "display_id", "total", "currency_code", "metadata", "shipping_address.first_name", "shipping_address.last_name"],
      filters: { id: data.id },
    })
    const o: any = rows[0]
    if (!o) return
    const c = client() as any
    const number = orderNumber(o.display_id)
    const name = [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") || "زبونة"
    const total = `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(o.total))} ${c.currencyLabel ?? "ر.ع"}`
    const payment = PAY[o.metadata?.payment_channel] ?? (o.metadata?.payment_channel || "—")
    const notifications = container.resolve(Modules.NOTIFICATION)
    await notifications.createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      data: { title: `طلب جديد ${number}`, description: `${name} — ${total} — الدفع ${payment}` },
      resource_id: o.id,
      resource_type: "order",
      idempotency_key: `merchant-feed:${o.id}`,
    } as any)
    const phones: string[] = (c.merchantPhones ?? []).map((p: string) => String(p).replace(/\D/g, "")).filter((p: string) => p.length >= 8)
    if (!phones.length) return
    const built = build("merchant_new_order", { name, number, total, payment, shipping: "", track: "" })
    for (const p of phones) {
      await notifications.createNotifications({
        to: p.startsWith("968") ? `+${p}` : `+968${p.slice(-8)}`,
        channel: "whatsapp",
        template: "merchant_new_order",
        data: { params: built.params, preview: built.preview },
        resource_id: o.id,
        resource_type: "order",
        idempotency_key: `merchant-wa:${o.id}:${p}`,
      })
    }
  } catch (e) {
    logger.warn(`[merchant] تنبيه طلب جديد ${data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
