import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

type Body = { number?: string; phone?: string }

const digits = (s?: string | null) => String(s ?? "").replace(/\D/g, "")

/**
 * المرحلة من تواريخ التنفيذ في Medusa (لا تُخزَّن fulfillment_status في القاعدة):
 * -1 ملغى، 1 قيد التجهيز، 2 في الطريق (أو جاهز للاستلام)، 3 تم التسليم
 */
function stageOf(status: string, f: { shipped_at?: string | null; delivered_at?: string | null }) {
  if (status === "canceled") return -1
  if (f.delivered_at || status === "completed") return 3
  if (f.shipped_at) return 2
  return 1
}

/**
 * POST /store/track — تتبّع طلب بلا تسجيل دخول: رقم الطلب (LN-0004 أو 4) + هاتف التوصيل.
 * رسالة الخطأ واحدة سواء كان الرقم أو الهاتف خطأ، حتى لا تُستخدم لتخمين الطلبات.
 */
export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const displayId = Number(digits(req.body.number))
  const phone = digits(req.body.phone).slice(-8)
  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "لم نجد طلباً بهذا الرقم وهذا الهاتف")
  // H5: الزبونة المسجّلة تتتبّع طلباتها بحسابها — لا هاتف في الرابط
  const customerId = (req as any).auth_context?.actor_type === "customer" ? (req as any).auth_context.actor_id : null
  if (!displayId || (!customerId && phone.length !== 8)) throw notFound

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "status", "created_at", "total", "metadata",
      "customer_id", "shipping_address.phone", "shipping_address.province", "shipping_address.city",
      "shipping_methods.name",
      "items.id", "items.product_title", "items.variant_title", "items.quantity", "items.unit_price", "items.thumbnail",
      "fulfillments.packed_at", "fulfillments.shipped_at", "fulfillments.delivered_at", "fulfillments.canceled_at", "fulfillments.created_at",
      "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
    ],
    filters: { display_id: displayId } as any, // display_id رقمي في القاعدة
  })
  const o: any = data[0]
  const own = !!customerId && o?.customer_id === customerId
  if (!o || (!own && (phone.length !== 8 || digits(o.shipping_address?.phone).slice(-8) !== phone))) throw notFound

  // H14: المرحلة من كل التنفيذات غير الملغاة (أبعد مرحلة)، لا من أول تنفيذ — تنفيذ ملغى لا يُحتسب
  const active = ((o.fulfillments ?? []) as any[]).filter((x) => !x.canceled_at)
  const pick = (k: string) => active.map((x) => x[k]).filter(Boolean).sort()[0] ?? null
  const f = { packed_at: pick("packed_at") ?? (active.length ? active[0].created_at : null), shipped_at: pick("shipped_at"), delivered_at: pick("delivered_at") }
  const meta = o.metadata ?? {}
  res.json({
    order: {
      id: o.id,
      display_id: o.display_id,
      status: o.status,
      stage: stageOf(o.status, f),
      // M20: بوليصة شركة الشحن (آخر تنفيذ نشط فيه رقم)
      shipment: (() => {
        const l = active.flatMap((x: any) => x.labels ?? []).filter((x: any) => x?.tracking_number).pop()
        return l ? { tracking_number: l.tracking_number, tracking_url: /^https?:\/\//.test(l.tracking_url ?? "") ? l.tracking_url : null } : null
      })(),
      shipping_code: meta.shipping_code ?? null,
      shipping_name: o.shipping_methods?.[0]?.name ?? null,
      province: o.shipping_address?.province ?? null,
      city: o.shipping_address?.city ?? null,
      total: o.total,
      times: { placed: o.created_at, packed: f.packed_at ?? null, shipped: f.shipped_at ?? null, delivered: f.delivered_at ?? null },
      items: (o.items ?? []).map((i: any) => ({
        id: i.id, title: i.product_title, variant: i.variant_title, quantity: i.quantity, unit_price: i.unit_price, thumbnail: i.thumbnail,
      })),
    },
  })
}
