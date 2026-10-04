import { MedusaService } from "@medusajs/framework/utils"
import { SeoRedirect } from "./models/redirect"
import { TrackingSettings } from "./models/tracking-settings"

export const SECRET_FIELDS = ["ga4_api_secret", "meta_access_token", "snap_access_token", "tiktok_access_token"] as const
export const PUBLIC_FIELDS = ["ga4_measurement_id", "meta_pixel_id", "snap_pixel_id", "tiktok_pixel_id", "clarity_project_id"] as const

class TrackingModuleService extends MedusaService({ TrackingSettings, SeoRedirect }) {
  /** الإعدادات الحالية (يُنشئ الصف الأول عند الحاجة) */
  async getSettings() {
    const [row] = await this.listTrackingSettings({}, { take: 1 })
    return row ?? (await this.createTrackingSettings({}))
  }

  /** المعرّفات العامة فقط — ما تحتاجه الواجهة لتحميل البكسلات */
  async publicConfig() {
    const s = await this.getSettings()
    return Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, (s as any)[k] || null])) as Record<(typeof PUBLIC_FIELDS)[number], string | null>
  }

  /** نسخة للوحة: الرموز السرية تظهر مخفية (آخر 4 أحرف) ولا تُرسل كاملة */
  async maskedSettings() {
    const s = (await this.getSettings()) as Record<string, any>
    const out: Record<string, unknown> = { ...s }
    for (const k of SECRET_FIELDS) out[k] = s[k] ? `••••${String(s[k]).slice(-4)}` : null
    return out
  }

  /** تحويل 301: من مسار قديم إلى الجديد، ويُحدَّث أي تحويل سابق يشير للقديم (بلا سلاسل) */
  async addRedirect(input: { from_path: string; to_path: string; entity: "product" | "category"; entity_id: string }) {
    if (input.from_path === input.to_path) return
    const chained = await this.listSeoRedirects({ to_path: input.from_path })
    for (const r of chained) await this.updateSeoRedirects({ id: r.id, to_path: input.to_path })
    const [same] = await this.listSeoRedirects({ from_path: input.from_path })
    if (same) await this.updateSeoRedirects({ id: same.id, to_path: input.to_path })
    else await this.createSeoRedirects(input)
    // مسار جديد كان قديماً سابقاً لا يجب أن يبقى محوَّلاً
    const [loop] = await this.listSeoRedirects({ from_path: input.to_path })
    if (loop) await this.deleteSeoRedirects(loop.id)
  }
}

export default TrackingModuleService
