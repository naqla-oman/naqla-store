import { formatAmount } from "./money"
import { storeConfig } from "../../store.config"

export type WaOrder = {
  number: string
  items: { title: string; variant?: string | null; qty: number; length?: number | null }[]
  total: number
  shipping?: string | null
  place?: string | null
  name?: string | null
  gift?: boolean
  giftMessage?: string | null
}

/** رسالة واتساب الجاهزة لتأكيد طلب مسجّل في المتجر */
export function orderMessage(o: WaOrder) {
  const cur = storeConfig.currencyLabel
  return [
    `مرحباً ${storeConfig.shortName}، أرغب بتأكيد طلبي رقم ${o.number}:`,
    ...o.items.map((i) => `• ${i.title}${i.variant ? ` — ${i.variant.replace(" / ", " · ")}` : ""}${i.length ? ` · طول ${i.length} سم` : ""} × ${i.qty}`),
    `الإجمالي: ${formatAmount(o.total)} ${cur}`,
    o.shipping ? `التوصيل: ${o.shipping}${o.place ? ` — ${o.place}` : ""}` : "",
    o.gift ? `هدية${o.giftMessage ? ` — رسالة البطاقة: ${o.giftMessage}` : ""}` : "",
    o.name ? `الاسم: ${o.name}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export const waUrl = (text: string) =>
  `https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(text)}`
