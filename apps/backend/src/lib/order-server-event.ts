import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { TRACKING_MODULE } from "../modules/tracking"
import type TrackingModuleService from "../modules/tracking/service"
import { SENDERS, type Platform, type ServerEvent, type ServerEventName } from "./server-events"
import { client } from "./client"

/**
 * يبني حدث الخادم من الطلب ويرسله لكل منصة مضبوطة.
 * event_id: purchase_<order_id> — نفسه في المتصفح (صفحة النجاح) فتُزال الازدواجية.
 * بيانات المطابقة من metadata.attribution التي تحفظها الواجهة عند الطلب (fbp/fbc/ttclid/ScCid/IP/UA).
 */
export async function sendOrderServerEvent(container: MedusaContainer, orderId: string, name: Exclude<ServerEventName, "test">) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const tracking = container.resolve<TrackingModuleService>(TRACKING_MODULE)
    const creds = await tracking.getSettings()
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "display_id", "total", "currency_code", "email", "customer_id", "created_at", "metadata",
        "shipping_address.phone", "items.quantity", "items.unit_price", "items.variant_id", "items.product_id"],
      filters: { id: orderId },
    })
    const o: any = data[0]
    if (!o) return
    const a = (o.metadata?.attribution ?? {}) as Record<string, any>
    const base = process.env.STOREFRONT_URL || "http://localhost:8000"
    const event: ServerEvent = {
      name,
      event_id: `${name === "purchase" ? "purchase" : "delivered"}_${o.id}`,
      time: name === "purchase" ? Math.floor(new Date(o.created_at).getTime() / 1000) : undefined,
      value: Number(o.total),
      currency: o.currency_code,
      order_id: o.id,
      url: `${base}/${client().country}/order/${o.id}/confirmed`,
      contents: (o.items ?? []).map((i: any) => ({ id: i.variant_id ?? i.product_id, quantity: i.quantity, price: Number(i.unit_price) })),
      user: {
        email: o.email,
        phone: o.shipping_address?.phone,
        external_id: o.customer_id,
        ip: a.ip, ua: a.ua, fbp: a.fbp, fbc: a.fbc,
        ttclid: a.last?.ttclid ?? a.first?.ttclid,
        sccid: a.last?.ScCid ?? a.first?.ScCid,
        ga_client_id: a.ga_client_id,
      },
    }
    // الموافقة: الإعلانات (Meta/Snap/TikTok) تتطلب موافقة ملفات الإعلانات، وGA4 موافقة التحليلات.
    // طلب بلا سجل موافقة يُعامل كرفض.
    const consent = (a.consent ?? {}) as { ads?: boolean; analytics?: boolean }
    const allowed: Platform[] = [...(consent.ads ? (["meta", "snap", "tiktok"] as Platform[]) : []), ...(consent.analytics ? (["ga4"] as Platform[]) : [])]
    if (!allowed.length) {
      logger.info(`[tracking] ${name} ${o.id}: لا موافقة على ملفات التتبع — لم يُرسل`)
      return
    }
    const results = await Promise.all(
      allowed.map((p) => SENDERS[p](creds, event).catch((err) => ({ platform: p, ok: false, status: 0, response: String(err?.message ?? err) })))
    )
    for (const r of results) {
      if (r.skipped) continue
      ;(r.ok ? logger.info : logger.warn).call(logger, `[tracking] ${name} ${r.platform} → ${r.status}${r.ok ? "" : ` ${r.response?.slice(0, 200)}`}`)
    }
  } catch (e) {
    logger.warn(`[tracking] ${name} ${orderId}: ${(e as Error).message}`)
  }
}
