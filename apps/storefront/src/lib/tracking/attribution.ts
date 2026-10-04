import "server-only"
import { cookies, headers } from "next/headers"

/** يقرأ مصدر الطلب وبيانات المطابقة عند الدفع (يُحفظ في metadata.attribution) */
const parse = (v?: string) => {
  if (!v) return null
  try { return JSON.parse(Buffer.from(v, "base64url").toString("utf8")) } catch { return null }
}

export type Consent = { analytics: boolean; ads: boolean }

export async function readConsent(): Promise<Consent> {
  const v = (await cookies()).get("_consent")?.value
  return { analytics: !!v?.includes("analytics"), ads: !!v?.includes("ads") }
}

export async function orderAttribution() {
  const c = await cookies()
  const h = await headers()
  const consent = await readConsent()
  const ga = c.get("_ga")?.value // GA1.1.<client_id>
  return {
    first: parse(c.get("_attr_first")?.value),
    last: parse(c.get("_attr_last")?.value),
    consent,
    // معرّفات المطابقة للإعلانات فقط بموافقة الزبون على ملفات الإعلانات
    ...(consent.ads
      ? {
          fbp: c.get("_fbp")?.value ?? null,
          fbc: c.get("_fbc")?.value ?? null,
          ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
          ua: h.get("user-agent")?.slice(0, 400) ?? null,
        }
      : {}),
    ...(consent.analytics && ga ? { ga_client_id: ga.split(".").slice(-2).join(".") } : {}),
  }
}
