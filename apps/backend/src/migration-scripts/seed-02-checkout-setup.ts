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
import { readFileSync } from "node:fs"
import { join } from "node:path"

type Shipping = { code: string; name: string; desc: string; amount: number; free_over?: number; provinces?: string[] }
type Promo = { code: string; type: "percentage" | "fixed"; value: number; description?: string }

const OFFLINE_PROVIDERS = ["pp_cod_offline", "pp_whatsapp_offline"]
const THAWANI_PROVIDER = "pp_thawani_thawani"

export default async function checkout_setup({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const payment = container.resolve(Modules.PAYMENT)
  const promotion = container.resolve(Modules.PROMOTION)

  const dataFile = process.env.STORE_DATA || "layan"
  const data = JSON.parse(readFileSync(join(process.cwd(), "data", `${dataFile}.json`), "utf-8"))
  const S = data.store as { currency: string; country: string; shipping: Shipping[]; promotions?: Promo[] }

  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "currency_code"] })
  const region = regions.find((r) => r.currency_code === S.currency)
  if (!region) {
    logger.warn("checkout-setup: لا توجد منطقة بعد — شغّلي البذرة الأولى أولاً")
    return
  }

  // ---------- طرق الدفع ----------
  const registered = (await payment.listPaymentProviders({})).map((p) => p.id)
  const wanted = [...OFFLINE_PROVIDERS, THAWANI_PROVIDER].filter((id) => registered.includes(id))
  await updateRegionsWorkflow(container).run({
    input: { selector: { id: region.id }, update: { payment_providers: wanted } },
  })
  logger.info(`checkout-setup: طرق الدفع للمنطقة → ${wanted.join(", ")}`)

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
          prices: [
            { currency_code: S.currency, amount: sh.amount },
            { region_id: region.id, amount: sh.amount },
          ],
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
