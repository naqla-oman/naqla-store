/** M21: أوزان الشحن للمتغيّرات القائمة الفارغة (store.json → shippingWeights، أو weight المنتج) */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { client } from "../lib/client"
import { weightFor } from "../lib/weights"

export default async function variant_weights({ container }: { container: MedusaContainer }) {
  const byHandle = new Map(((client() as any).products ?? []).map((p: any) => [p.handle, p]))
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "weight", "product.handle", "product.categories.handle"],
    pagination: { take: 100000 },
  })
  const updates = (data as any[])
    .filter((v) => v.weight == null)
    .map((v) => {
      const p: any = byHandle.get(v.product?.handle) ?? { category: v.product?.categories?.[0]?.handle }
      return { id: v.id, weight: weightFor(p) }
    })
  if (updates.length) await updateProductVariantsWorkflow(container).run({ input: { product_variants: updates } as any })
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`variant-weights: ${updates.length} متغيّراً`)
}
