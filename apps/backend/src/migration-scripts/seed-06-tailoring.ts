/**
 * خدمة «التفصيل الخاص» وامتياز الماسية — خلف features.tailoring.
 * - منتج خدمة واحد (store.json → tailoring) بخيار «الخدمة» ومتغيّر لكل خدمة بسعرها، بلا مخزون
 *   (metadata.service = true فيُستبعد من قوائم المتجر ويُضاف من زر «تفصيل على مقاسك»)
 * - لكل مستوى له tailoringDiscount: عرض تلقائي بالنسبة على منتج التفصيل فقط لمجموعة المستوى وما فوقه
 * آمن للتكرار: لا يُنشئ ما هو موجود.
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { client, clientDir, feature } from "../lib/client"

type Tailoring = {
  handle: string
  title: string
  description: string
  image?: string
  services: { key: string; title: string; price: number; categories: string[] }[]
  measurements: { key: string; label: string }[]
}

const OPTION_TITLE = "الخدمة"

export default async function tailoring({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products = container.resolve(Modules.PRODUCT)
  const customers = container.resolve(Modules.CUSTOMER)
  const promotion = container.resolve(Modules.PROMOTION)
  const files = container.resolve(Modules.FILE)

  const store = client()
  const cfg = (store as any).tailoring as Tailoring | undefined
  if (!feature("tailoring") || !cfg?.services?.length) {
    logger.info("tailoring: التفصيل الخاص مُطفأ في store.json — لا شيء")
    return
  }

  // ---- منتج الخدمة ----
  let [product] = await products.listProducts({ handle: cfg.handle })
  if (!product) {
    const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
    const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "type"] })
    const profile = profiles.find((p: any) => p.type === "default") ?? profiles[0]

    let image: string | undefined
    if (cfg.image && existsSync(join(clientDir(), cfg.image))) {
      const [file] = await files.createFiles([
        { filename: basename(cfg.image), mimeType: "image/jpeg", content: readFileSync(join(clientDir(), cfg.image)).toString("base64"), access: "public" },
      ])
      image = file.url
    }

    const { result: [option] } = await createProductOptionsWorkflow(container).run({
      input: { product_options: [{ title: OPTION_TITLE, values: cfg.services.map((s) => s.title) }] },
    })
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: cfg.title,
            handle: cfg.handle,
            description: cfg.description,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: profile.id,
            sales_channels: channels.map((c: any) => ({ id: c.id })),
            options: [{ id: option.id }],
            ...(image ? { images: [{ url: image }], thumbnail: image } : {}),
            metadata: {
              service: true, // يُستبعد من قوائم المنتجات في الواجهة
              tailoring_services: cfg.services.map((s) => ({ key: s.key, title: s.title, categories: s.categories })),
              tailoring_measurements: cfg.measurements,
            },
            variants: cfg.services.map((s) => ({
              title: s.title,
              sku: `TAILOR-${s.key.toUpperCase()}`,
              options: { [OPTION_TITLE]: s.title },
              manage_inventory: false, // خدمة: لا مخزون
              prices: [{ amount: s.price, currency_code: store.currency }],
              metadata: { service_key: s.key },
            })),
          },
        ],
      },
    })
    product = result[0] as any
    logger.info(`tailoring: «${cfg.title}» بـ ${cfg.services.length} خدمات (${cfg.services.map((s) => `${s.title} ${s.price}`).join("، ")})`)
  }

  // ---- خصم المستوى على التفصيل فقط ----
  if (!feature("loyalty") || !feature("loyaltyTiers")) return
  const tiers = store.loyalty.tiers
  const groups = (await customers.listCustomerGroups({}, { take: 100 })).filter((g) => (g.metadata as any)?.loyalty_tier)
  for (const tier of tiers.filter((t) => t.tailoringDiscount && t.promoCode)) {
    if ((await promotion.listPromotions({ code: tier.promoCode })).length) continue
    // المستوى وما فوقه
    const groupIds = tiers
      .filter((t) => t.min >= tier.min)
      .map((t) => groups.find((g) => (g.metadata as any).loyalty_tier === t.key)?.id)
      .filter(Boolean) as string[]
    if (!groupIds.length) {
      logger.warn(`tailoring: لا مجموعة لمستوى ${tier.key} — شغّلي seed-05 أولاً`)
      continue
    }
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: tier.promoCode!,
            type: "standard",
            status: "active",
            is_automatic: true,
            is_tax_inclusive: true,
            rules: [{ attribute: "customer.groups.id", operator: "in", values: groupIds }],
            application_method: {
              type: "percentage",
              target_type: "items",
              allocation: "across",
              value: tier.tailoringDiscount!,
              // على منتج التفصيل فقط
              target_rules: [{ attribute: "items.product.id", operator: "eq", values: [product.id] }],
            },
          },
        ],
      },
    })
    logger.info(`tailoring: خصم ${tier.tailoringDiscount}٪ على التفصيل لمستوى ${tier.key} وما فوقه (${tier.promoCode})`)
  }
}
