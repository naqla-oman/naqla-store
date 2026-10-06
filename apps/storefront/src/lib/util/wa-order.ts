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
type T = (key: string, vals?: Record<string, string | number>) => string
export function orderMessage(t: T, cur: string, o: WaOrder) {
  return [
    t("common.waConfirm", { store: storeConfig.shortName, number: o.number }),
    ...o.items.map((i) => `• ${i.title}${i.variant ? ` — ${i.variant.replace(" / ", " · ")}` : ""}${i.length ? ` · ${t("common.lengthCm", { len: i.length })}` : ""} × ${i.qty}`),
    t("common.totalLine", { total: `${formatAmount(o.total)} ${cur}` }),
    o.shipping ? t("common.shippingLine", { shipping: o.shipping }) + (o.place ? ` — ${o.place}` : "") : "",
    o.gift ? t("common.giftWord") + (o.giftMessage ? ` — ${t("common.cardMessage", { msg: o.giftMessage })}` : "") : "",
    o.name ? t("common.nameLine", { name: o.name }) : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export const waUrl = (text: string) =>
  `https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(text)}`
