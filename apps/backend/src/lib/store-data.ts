import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { client, clientDir } from "./client"

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

/** لغة الطلب (order.locale: en-US / ar-SA) → ar | en */
export const langOfLocale = (locale?: string | null): "ar" | "en" => (String(locale ?? "").toLowerCase().startsWith("en") ? "en" : "ar")

let enCache: Record<string, any> | null | undefined
/** قسم store من clients/<slug>/locales/en.json (إن وُجد) — أسماء المتجر والمحل بالإنجليزية للإشعارات */
export function storeDataEn(): Record<string, any> | null {
  if (enCache === undefined) {
    const f = join(clientDir(), "locales", "en.json")
    try { enCache = existsSync(f) ? ((JSON.parse(readFileSync(f, "utf-8")) as any).store ?? null) : null } catch { enCache = null }
  }
  return enCache ?? null
}
/** اسم المتجر واسم المحل بلغة الإشعار (الإنجليزية من en.json، وإلا العربية) */
export function storeNames(lang: "ar" | "en") {
  const s = storeData(), en = lang === "en" ? storeDataEn() : null
  return { name: (en?.name as string) || s.name, place: (en?.location?.name as string) || s.location?.name || (en?.name as string) || s.name }
}
