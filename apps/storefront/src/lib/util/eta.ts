import { storeConfig } from "../../store.config"

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]

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
export function deliveryEta(code: string | undefined | null, province?: string | null, now = new Date()) {
  const cfg = storeConfig.checkout.shipping[code ?? ""]
  if (cfg && cfg.eta !== "standard") return cfg.eta
  const { day, hour } = storeClock(now)
  const add = hour < storeConfig.cutoffHour ? 1 : 2
  const inCapital = province === storeConfig.checkout.governorates[0].code
  return `يصلك ${DAYS[(day + add) % 7]} — ${inCapital ? "داخل مسقط" : "خلال 24–48 ساعة"}`
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
