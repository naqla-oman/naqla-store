import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow, completeCartWorkflow, updateCartPromotionsWorkflow, updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { client } from "../../lib/client"

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

/* ===== H4: شروط الأكواد من store.json (لأول طلب، لا يُجمع) ===== */
const rules = () => new Map((client().promotions ?? []).map((p) => [p.code.toUpperCase(), p]))

async function cartIdentity(container: MedusaContainer, cartId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "email", "customer_id", "shipping_address.phone", "promotions.code", "promotions.is_automatic"],
    filters: { id: cartId },
  })
  return data[0] as any
}

/** طلبات سابقة غير ملغاة بنفس الحساب أو البريد أو آخر 8 أرقام من الهاتف */
async function hasPreviousOrder(container: MedusaContainer, who: { customer_id?: string | null; email?: string | null; phone?: string | null }) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const email = (who.email ?? "").trim().toLowerCase()
  const phone = String(who.phone ?? "").replace(/\D/g, "").slice(-8)
  if (!who.customer_id && !email && phone.length !== 8) return false
  const r = await pg.raw(
    `select 1 from "order" o left join order_address a on a.id = o.shipping_address_id
      where o.deleted_at is null and o.status <> 'canceled' and o.is_draft_order = false
        and ((?::text is not null and o.customer_id = ?) or (?::text <> '' and lower(o.email) = ?)
             or (length(?::text) = 8 and right(regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g'), 8) = ?))
      limit 1`,
    [who.customer_id ?? null, who.customer_id ?? null, email, email, phone, phone]
  )
  return (r.rows ?? r).length > 0
}

function assertExclusive(codes: string[]) {
  const R = rules()
  const manual = [...new Set(codes.map((c) => c.toUpperCase()))]
  const solo = manual.find((c) => R.get(c)?.exclusive)
  if (solo && manual.length > 1) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `الكود ${solo} لا يُجمع مع أكواد خصم أخرى`)
  }
}

async function assertFirstOrder(container: MedusaContainer, cart: any, codes: string[]) {
  const R = rules()
  const first = codes.map((c) => c.toUpperCase()).find((c) => R.get(c)?.firstOrderOnly)
  if (!first) return
  if (await hasPreviousOrder(container, { customer_id: cart.customer_id, email: cart.email, phone: cart.shipping_address?.phone })) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `الكود ${first} لأول طلب فقط`)
  }
}

updateCartPromotionsWorkflow.hooks.validate(async ({ input }, { container }) => {
  const i = input as any
  const cart = await cartIdentity(container, i.cart_id ?? i.cart?.id)
  if (!cart) return
  const current = (cart.promotions ?? []).filter((p: any) => !p.is_automatic && p.code).map((p: any) => p.code as string)
  const incoming: string[] = i.promo_codes ?? []
  const action = i.action ?? "add"
  if (action === "remove") return
  const resulting = action === "replace" ? incoming : [...current, ...incoming]
  assertExclusive(resulting)
  await assertFirstOrder(container, cart, incoming)
})

completeCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const id = (input as any).id
  await assertCartStock(container, id)
  // H4: عند الإتمام الهوية كاملة (البريد والهاتف) — ضيفة لا تطبّق كود الطلب الأول قبل إدخال بياناتها
  const cart = await cartIdentity(container, id)
  const codes = (cart?.promotions ?? []).filter((p: any) => !p.is_automatic && p.code).map((p: any) => p.code as string)
  if (codes.length) {
    assertExclusive(codes)
    await assertFirstOrder(container, cart, codes)
  }
})
