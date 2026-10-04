import { storeConfig } from "../store.config"

/**
 * صيغة المخاطبة حسب store.json → voice:
 *   "f" مؤنث (اطلبي)، "m" مذكر (اطلب)، "neutral" محايد.
 * المحايد يستخدم صيغة الأمر العامة (اطلب) ما لم تُعطَ صيغة خاصة له،
 * وتُعطى للأسماء التي تحمل جنساً (زبونة → عميل، عضوة ذهبية → عضوية ذهبية).
 */
export type Voice = "f" | "m" | "neutral"

export const g = (f: string, m: string, n?: string) =>
  storeConfig.voice === "f" ? f : storeConfig.voice === "m" ? m : n ?? m
