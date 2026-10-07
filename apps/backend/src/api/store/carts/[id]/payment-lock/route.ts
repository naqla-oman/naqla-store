import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { storeError } from "../../../../../lib/store-errors"

/**
 * POST /store/carts/:id/payment-lock { session_id } — قفل السلة قبل التحويل إلى ثواني (H2)
 * DELETE /store/carts/:id/payment-lock — فكّ القفل عند الإلغاء
 * الجلسة يجب أن تكون جلسة ثواني فعلية لهذه السلة.
 */
async function cartWithSessions(req: MedusaRequest) {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "metadata", "completed_at", "payment_collection.payment_sessions.provider_id", "payment_collection.payment_sessions.data"],
    filters: { id: req.params.id },
  })
  const cart: any = data[0]
  if (!cart || cart.completed_at) throw storeError(MedusaError.Types.NOT_FOUND, "cart_not_found")
  return cart
}

export const POST = async (req: MedusaRequest<{ session_id?: string }>, res: MedusaResponse) => {
  const cart = await cartWithSessions(req)
  const sid = String(req.body?.session_id ?? "")
  const s = (cart.payment_collection?.payment_sessions ?? []).find((x: any) => x.provider_id === "pp_thawani_thawani" && x.data?.session_id === sid)
  if (!s) throw storeError(MedusaError.Types.INVALID_DATA, "thawani_session_missing")
  const lock = { provider: "thawani", session_id: sid, amount_baisa: s.data?.amount_baisa ?? null, at: Date.now() }
  await updateCartWorkflow(req.scope).run({ input: { id: cart.id, metadata: { ...(cart.metadata ?? {}), payment_lock: lock } } })
  res.json({ locked: true })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const cart = await cartWithSessions(req)
  const { payment_lock: _, ...rest } = cart.metadata ?? {}
  await updateCartWorkflow(req.scope).run({ input: { id: cart.id, metadata: { ...rest, payment_lock: null } } })
  res.json({ locked: false })
}
