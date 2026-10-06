/**
 * إعداد الدفع والتوصيل والعروض — يعمل بعد initial-data-seed (ترتيب أبجدي) ومرة واحدة لكل قاعدة.
 * - طرق الدفع للمنطقة: الدفع عند الاستلام + واتساب (+ ثواني إن كان مفعّلاً)
 * - خيارات التوصيل المقيّدة بمحافظات (provinces) تُنقل إلى منطقة خدمة خاصة بها
 *   فلا يعرضها Medusa إلا لعنوان في تلك المحافظة (مثل «سريع داخل مسقط»)
 * - أكواد الخصم من data/<client>.json → store.promotions
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createPromotionsWorkflow,
  createShippingOptionsWorkflow,
  deleteShippingOptionsWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { client, feature } from "../lib/client"
import { syncPaymentProviders } from "../lib/payment-providers"
import { shippingPrices } from "../lib/shipping-prices"

type Shipping = { code: string; name: string; desc: string; amount: number; free_over?: number; provinces?: string[] }
type Promo = { code: string; type: "percentage" | "fixed"; value: number; description?: string; limit?: number }

export default async function checkout_setup({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const payment = container.resolve(Modules.PAYMENT)
  const promotion = container.resolve(Modules.PROMOTION)

  const data = client()
  const S = {
    currency: data.currency,
    country: data.country,
    shipping: data.shipping.filter((sh) => !(sh.code === "express" && !feature("expressDelivery"))) as Shipping[],
    promotions: (data.promotions ?? []) as Promo[],
  }

  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "currency_code"] })
  const region = regions.find((r) => r.currency_code === S.currency)
  if (!region) {
    logger.warn("checkout-setup: لا توجد منطقة بعد — شغّلي البذرة الأولى أولاً")
    return
  }

  // ---------- طرق الدفع (المنطق المشترك مع مزامنة الإقلاع — M12) ----------
  await syncPaymentProviders(container)

  // ---------- التوصيل المقيّد بمحافظات ----------
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone_id", "shipping_profile_id", "type.code", "service_zone.fulfillment_set_id"],
  })
  for (const sh of S.shipping.filter((x) => x.provinces?.length)) {
    const current = options.find((o) => o.type?.code === sh.code)
    if (!current) continue
    const zoneName = `${sh.name} — ${sh.provinces!.join("، ")}`
    const [zone] = await fulfillment.createServiceZones([
      {
        name: zoneName,
        fulfillment_set_id: current.service_zone.fulfillment_set_id,
        geo_zones: sh.provinces!.map((p) => ({ type: "province" as const, country_code: S.country, province_code: p })),
      },
    ])
    await deleteShippingOptionsWorkflow(container).run({ input: { ids: [current.id] } })
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: sh.name,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: zone.id,
          shipping_profile_id: current.shipping_profile_id,
          type: { label: sh.name, description: sh.desc, code: sh.code },
          // منخفضة: مع قاعدة free_over (كانت تسقط عند النقل إلى منطقة المحافظات)
          prices: shippingPrices(sh, S.currency, region.id),
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info(`checkout-setup: «${sh.name}» أصبح متاحاً فقط في ${sh.provinces!.join("، ")}`)
  }

  // ---------- أكواد الخصم ----------
  for (const p of S.promotions ?? []) {
    const exists = await promotion.listPromotions({ code: p.code })
    if (exists.length) continue
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: p.code,
            type: "standard",
            status: "active",
            is_automatic: false,
            // H4: حد الاستخدام الكلي من store.json
            ...(p.limit ? { limit: p.limit } : {}),
            application_method: {
              type: p.type,
              target_type: "items",
              allocation: "across",
              value: p.value,
              currency_code: S.currency,
              description: p.description,
            } as any, // description يُخزَّن في Medusa لكنه غير مُعرَّف في النوع
          },
        ],
      },
    })
    logger.info(`checkout-setup: كود الخصم ${p.code} (${p.value}${p.type === "percentage" ? "٪" : ""})`)
  }
}
