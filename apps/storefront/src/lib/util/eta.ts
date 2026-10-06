import { storeConfig } from "../../store.config"

type T = (key: string, vals?: Record<string, string | number>) => string
/** اسم اليوم حسب اللغة (الفهرس 0 = الأحد) */
const dayName = (locale: string, idx: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { weekday: "long" }).format(new Date(2026, 0, 4 + ((idx % 7) + 7) % 7))

/** اليوم والساعة الآن بتوقيت المتجر (مسقط) */
export function storeClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: storeConfig.product.delivery.timezone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")), hour: Number(get("hour")) }
}

/** نص موعد الوصول حسب نوع التوصيل (type.code في Medusa) والمحافظة */
export function deliveryEta(t: T, locale: string, code: string | undefined | null, province?: string | null, now = new Date()) {
  const cfg = storeConfig.checkout.shipping[code ?? ""]
  if (cfg && cfg.eta !== "standard") return cfg.eta
  const { day, hour } = storeClock(now)
  const add = hour < storeConfig.cutoffHour ? 1 : 2
  const inCapital = province === storeConfig.checkout.governorates[0].code
  return t("common.arrives", { day: dayName(locale, day + add), where: inCapital ? t("common.inCapital") : t("common.within48") })
}

export const governorateName = (code?: string | null) =>
  storeConfig.checkout.governorates.find((g) => g.code === code)?.name ?? code ?? ""

export const orderNumber = (displayId?: number | null) =>
  `${storeConfig.checkout.orderPrefix}${String(displayId ?? "").padStart(4, "0")}`

/** M13: التوصيل السريع «اليوم» قبل ساعة القطع وفي أيام العمل (نفس قاعدة الخادم) */
export function expressOpen(now = new Date()) {
  const tz = storeConfig.product.delivery.timezone
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now).map((p) => [p.type, p.value]))
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)
  return Number(parts.hour) < storeConfig.cutoffHour && !(storeConfig.deliveryOffDays ?? [5]).includes(day)
}
