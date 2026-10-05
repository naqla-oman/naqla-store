import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow, completeCartWorkflow, updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"

/**
 * C5: المخزون يُفحص على مجموع كميات المتغيّر في كل أسطر السلة — لا لكل سطر وحده.
 * (السطر نفسه قد يتكرر بـ metadata مختلفة، مثل طول العباءة، فيُباع أكثر من المتوفر.)
 * يُطبَّق عند الإضافة والتعديل والإتمام.
 */
type Change = { add?: { variant_id: string; quantity: number }[]; set?: { item_id: string; quantity: number } }

async function assertCartStock(container: MedusaContainer, cartId: string, change: Change = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "cart", fields: ["id", "items.id", "items.variant_id", "items.quantity"], filters: { id: cartId } })
  const totals = new Map<string, number>()
  for (const i of ((data[0] as any)?.items ?? []) as any[]) {
    if (!i.variant_id) continue
    const q = change.set && change.set.item_id === i.id ? change.set.quantity : Number(i.quantity)
    totals.set(i.variant_id, (totals.get(i.variant_id) ?? 0) + q)
  }
  for (const a of change.add ?? []) totals.set(a.variant_id, (totals.get(a.variant_id) ?? 0) + Number(a.quantity))
  if (!totals.size) return

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "manage_inventory", "allow_backorder", "product.title",
      "inventory_items.required_quantity", "inventory_items.inventory.location_levels.stocked_quantity", "inventory_items.inventory.location_levels.reserved_quantity"],
    filters: { id: [...totals.keys()] },
  })
  for (const v of variants as any[]) {
    if (!v.manage_inventory || v.allow_backorder) continue
    // المتاح = أقل ما يكفيه كل عنصر مخزون مطلوب للمتغيّر (عادة عنصر واحد)
    const available = Math.min(
      ...((v.inventory_items ?? []) as any[]).map((ii) => {
        const levels = ii.inventory?.location_levels ?? []
        const free = levels.reduce((s: number, l: any) => s + Number(l.stocked_quantity || 0) - Number(l.reserved_quantity || 0), 0)
        return Math.floor(free / Math.max(1, Number(ii.required_quantity || 1)))
      }),
      Number.MAX_SAFE_INTEGER
    )
    const wanted = totals.get(v.id) ?? 0
    if (wanted > available) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `الكمية المطلوبة من «${v.product?.title ?? ""} — ${v.title}» (${wanted}) أكبر من المتوفر (${Math.max(0, available)})`
      )
    }
  }
}

addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const i = input as any
  await assertCartStock(container, i.cart_id ?? i.cart?.id, { add: (i.items ?? []).filter((x: any) => x.variant_id) })
})

updateLineItemInCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const i = input as any
  const quantity = i.update?.quantity
  if (quantity == null) return
  await assertCartStock(container, i.cart_id ?? i.cart?.id, { set: { item_id: i.item_id, quantity: Number(quantity) } })
})

completeCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await assertCartStock(container, (input as any).id)
})
