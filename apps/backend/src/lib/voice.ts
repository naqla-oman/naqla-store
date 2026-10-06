import { client } from "./client"

/** رسائل الخادم بمخاطبة المتجر: f للنساء، m للرجال، neutral محايدة (الافتراضي: صيغة المذكر إن لم تُعطَ المحايدة) */
export const g = (f: string, m: string, n?: string) => {
  const v = (client() as any).voice ?? "neutral"
  return v === "f" ? f : v === "m" ? m : n ?? m
}
