/**
 * امتيازات مستويات الولاء عبر مجموعات العملاء.
 * - مجموعة لكل مستوى فوق الأساسي (metadata.loyalty_tier) من data/<client>.json → store.tier_perks
 * - free_shipping: عرض تلقائي يجعل كل طرق التوصيل مجانية لأعضاء هذا المستوى وما فوقه
 * - يزامن عضوية الزبونات الحاليات حسب نقاطهن المؤكَّدة
 * آمن للتكرار: لا يُنشئ ما هو موجود.
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomerGroupsWorkflow, createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { LOYALTY_MODULE } from "../modules/loyalty"
import type LoyaltyModuleService from "../modules/loyalty/service"
import { syncLoyaltyTierWorkflow } from "../workflows/sync-loyalty-tier"
import { readFileSync } from "node:fs"
import { join } from "node:path"

type Perks = Record<string, { group: string; free_shipping?: boolean; promo_code?: string }>

export default async function loyalty_tiers({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const customers = container.resolve(Modules.CUSTOMER)
  const promotion = container.resolve(Modules.PROMOTION)
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)

  const data = JSON.parse(readFileSync(join(process.cwd(), "data", `${process.env.STORE_DATA || "layan"}.json`), "utf-8"))
  const perks = (data.store.tier_perks ?? {}) as Perks
  const tiers = loyalty.options.tiers

  // ---- المجموعات ----
  const existing = await customers.listCustomerGroups({}, { take: 100 })
  const groupOf: Record<string, string> = {}
  for (const [key, cfg] of Object.entries(perks)) {
    const found = existing.find((g) => (g.metadata as any)?.loyalty_tier === key)
    if (found) { groupOf[key] = found.id; continue }
    const { result } = await createCustomerGroupsWorkflow(container).run({
      input: { customersData: [{ name: cfg.group, metadata: { loyalty_tier: key } }] },
    })
    groupOf[key] = result[0].id
    logger.info(`loyalty-tiers: مجموعة «${cfg.group}» (${key})`)
  }

  // ---- التوصيل المجاني ----
  for (const [key, cfg] of Object.entries(perks)) {
    if (!cfg.free_shipping || !cfg.promo_code) continue
    if ((await promotion.listPromotions({ code: cfg.promo_code })).length) continue
    const min = tiers.find((t) => t.key === key)?.min ?? 0
    // المستوى وكل ما فوقه
    const groupIds = tiers.filter((t) => t.min >= min && groupOf[t.key]).map((t) => groupOf[t.key])
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: cfg.promo_code,
            type: "standard",
            status: "active",
            is_automatic: true,
            rules: [{ attribute: "customer.groups.id", operator: "in", values: groupIds }],
            application_method: {
              type: "percentage",
              target_type: "shipping_methods",
              allocation: "each",
              value: 100,
              description: `توصيل مجاني — امتياز ${tiers.find((t) => t.key === key)?.name ?? key}`,
            } as any,
          },
        ],
      },
    })
    logger.info(`loyalty-tiers: توصيل مجاني دائماً لمستوى ${key} وما فوقه (${cfg.promo_code})`)
  }

  // ---- مزامنة الزبونات الحاليات ----
  const entries = await loyalty.listLoyaltyEntries({}, { select: ["customer_id"], take: 10000 })
  const ids = Array.from(new Set(entries.map((e) => e.customer_id)))
  for (const customer_id of ids) {
    await syncLoyaltyTierWorkflow(container).run({ input: { customer_id } })
  }
  logger.info(`loyalty-tiers: زُومنت عضوية ${ids.length} زبونة`)
}
