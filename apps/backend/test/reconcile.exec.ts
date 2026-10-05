/** اختبار مهمة مطابقة ثواني داخل حاوية Medusa: npx medusa exec ./test/reconcile.exec.ts */
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { readFileSync } from "node:fs"
import { reconcileThawani } from "../src/jobs/thawani-reconcile"

export default async function run({ container }: any) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const carts = container.resolve(Modules.CART)
  const old = Date.now() - 10 * 60_000
  const h2 = JSON.parse(readFileSync("/home/claude/h2_cart.txt", "utf8"))
  const codCart = readFileSync("/home/claude/cod_cart.txt", "utf8").trim()
  const cancelCart = readFileSync("/home/claude/cancel_cart.txt", "utf8").trim()
  const lock = async (id: string, session_id: string) => {
    const c = await carts.retrieveCart(id, { select: ["metadata"] })
    await updateCartWorkflow(container).run({ input: { id, metadata: { ...(c.metadata ?? {}), payment_lock: { provider: "thawani", session_id, at: old } } } })
  }
  await lock(codCart, "sim_paid_cod")
  await lock(h2.cart, h2.session)
  await lock(cancelCart, "sim_cancelled")
  const fake = async (id: string) =>
    id === "sim_cancelled" ? { payment_status: "cancelled", total_amount: 0 } : { payment_status: "paid", total_amount: 10000 }
  const summary = await reconcileThawani(container, fake)
  const state = async (id: string) => {
    const { data } = await query.graph({ entity: "cart", fields: ["id", "completed_at", "metadata"], filters: { id } })
    const c: any = data[0]
    return { completed: !!c.completed_at, lock: !!c.metadata?.payment_lock, flag: c.metadata?.thawani_reconcile?.status ?? null }
  }
  console.log("SUMMARY", JSON.stringify(summary))
  console.log("PAID_COD", JSON.stringify(await state(codCart)))
  console.log("PAID_THAWANI_UNAUTH", JSON.stringify(await state(h2.cart)))
  console.log("CANCELLED", JSON.stringify(await state(cancelCart)))
}
