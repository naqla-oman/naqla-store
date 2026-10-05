/**
 * M17: خيار شحن للإرجاع — بدونه لا يُستلم أي مرتجع من اللوحة («Cannot receive the Return at location null»)
 * والمتجر يعلن الاستبدال والإرجاع. «إرجاع إلى المحل» مجاني، مخفي عن الواجهة (enabled_in_store=false).
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { client } from "../lib/client"

export default async function return_options({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const c = client() as any

  const existing = await fulfillment.listShippingOptions({}, { relations: ["rules"], take: 500 })
  if (existing.some((o: any) => (o.rules ?? []).some((r: any) => r.attribute === "is_return" && String(r.value) === "true"))) {
    logger.info("return-options: موجود مسبقاً")
    return
  }
  const { data: sets } = await query.graph({ entity: "fulfillment_set", fields: ["id", "service_zones.id"] })
  const zone = (sets as any[]).flatMap((s) => s.service_zones ?? [])[0]
  const [profile] = await fulfillment.listShippingProfiles({ type: "default" }, { take: 1 })
  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "currency_code"] })
  if (!zone || !profile || !regions.length) {
    logger.warn("return-options: لا منطقة خدمة أو ملف شحن أو منطقة — تخطٍّ")
    return
  }
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "إرجاع إلى المحل",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: zone.id,
        shipping_profile_id: profile.id,
        type: { label: "إرجاع", description: `استبدال وإرجاع خلال ${c.returnDays ?? 7} يوماً`, code: "return" },
        prices: [
          { currency_code: String(c.currency ?? (regions[0] as any).currency_code), amount: 0 },
          ...(regions as any[]).map((r) => ({ region_id: r.id, amount: 0 })),
        ],
        rules: [
          { attribute: "enabled_in_store", value: "false", operator: "eq" as const },
          { attribute: "is_return", value: "true", operator: "eq" as const },
        ],
      },
    ],
  })
  logger.info("return-options: أُنشئ «إرجاع إلى المحل»")
}
