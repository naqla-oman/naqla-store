import { getT } from "@/i18n/t"
import { storeConfig } from "@/store.config"
import { localizedStoreConfig } from "@/i18n/store-config"
import { getLocale } from "next-intl/server"

/**
 * المرحلة 4: أخطاء الخادم رموز ثابتة (`otp_cooldown`، أو `length_range {"min":120,"max":200}`) تُترجم هنا من errors.<code>.
 * رموز المحافظات (gov) تُحوَّل إلى اسمها بلغة الصفحة. رسالة غير مرمَّزة ← null (يستعمل المستدعي رسالته العامة).
 */
const RE = /^([a-z_]+)(?: (\{.*\}))?$/
export function parseServerError(message: unknown): { code: string; params: Record<string, string | number> } | null {
  const m = RE.exec(String(message ?? "").trim())
  if (!m) return null
  let params: Record<string, string | number> = {}
  try { params = m[2] ? JSON.parse(m[2]) : {} } catch { /* بلا معاملات */ }
  return { code: m[1], params }
}

export async function translateServerError(message: unknown): Promise<string | null> {
  const p = parseServerError(message)
  if (!p) return null
  const t = await getT("errors")
  const sc = localizedStoreConfig(await getLocale().catch(() => "ar"))
  const params = { ...p.params }
  if (typeof params.gov === "string") {
    const i = storeConfig.checkout.governorates.findIndex((g) => g.code === params.gov)
    if (i >= 0) params.gov = sc.checkout.governorates[i]?.name ?? params.gov
  }
  try {
    const out = t(p.code, params)
    // next-intl يعيد المفتاح نفسه (errors.code) إن غاب — لا مفاتيح خام للزبونة
    return out && !out.startsWith("errors.") ? out : null
  } catch { return null }
}

/** الرسالة المترجمة إن كانت رمزاً، وإلا الرسالة العامة */
export async function serverErrorOr(e: unknown, fallback: string) {
  return (await translateServerError((e as any)?.message)) ?? fallback
}
