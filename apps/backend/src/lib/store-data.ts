import { client } from "./client"

/** واجهة مختصرة لبيانات المتجر المستخدمة في الإشعارات والتتبّع */
export function storeData() {
  const c = client()
  return {
    name: c.name,
    name_en: c.nameEn,
    country: c.country,
    currency: c.currency,
    order_prefix: c.orderPrefix,
    location: c.location,
  }
}

export const orderNumber = (displayId?: number | null) =>
  `${storeData().order_prefix ?? "#"}${String(displayId ?? "").padStart(4, "0")}`
