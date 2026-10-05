import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflow, updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { LOCK_TTL_MS, type PaymentLock } from "../lib/cart-lock"

/**
 * H2: مطابقة جلسات ثواني المدفوعة بلا طلب (أغلقت الزبونة الصفحة قبل العودة، أو انقطع الاتصال).
 * كل 10 دقائق: السلال المقفلة للدفع منذ 5 دقائق فأكثر ← حالة الجلسة من ثواني مباشرة:
 *   مدفوعة → إتمام السلة طلباً؛ فشل الإتمام → خطأ واضح وعلامة على السلة (استرداد يدوي)
 *   ملغاة، أو غير مدفوعة وانتهى القفل → فكّ القفل
 */
const GRACE_MS = 5 * 60_000

export async function reconcileThawani(container: MedusaContainer, fetchSession?: (id: string) => Promise<{ payment_status: string; total_amount: number }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const base = process.env.THAWANI_MODE === "live" ? "https://checkout.thawani.om" : "https://uatcheckout.thawani.om"
  const get =
    fetchSession ??
    (async (id: string) => {
      const res = await fetch(`${base}/api/v1/checkout/session/${id}`, {
        headers: { "thawani-api-key": process.env.THAWANI_SECRET_KEY ?? "" },
        signal: AbortSignal.timeout(15000),
      })
      const j = (await res.json()) as { data?: { payment_status: string; total_amount: number } }
      if (!res.ok || !j.data) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Thawani ${res.status}`)
      return j.data
    })

  const carts = await container.resolve(Modules.CART).listCarts(
    { completed_at: null, updated_at: { $gte: new Date(Date.now() - 3 * 86400_000) } } as any,
    { select: ["id", "metadata"], take: 1000 }
  )
  const summary = { checked: 0, completed: 0, released: 0, failed: 0 }
  for (const cart of carts) {
    const lock = (cart.metadata as any)?.payment_lock as PaymentLock | null | undefined
    if (!lock?.session_id || Date.now() - Number(lock.at) < GRACE_MS) continue
    summary.checked++
    const release = (extra: Record<string, unknown> = {}) =>
      updateCartWorkflow(container).run({ input: { id: cart.id, metadata: { ...(cart.metadata ?? {}), payment_lock: null, ...extra } } })
    try {
      const s = await get(lock.session_id)
      if (s.payment_status === "paid") {
        try {
          await completeCartWorkflow(container).run({ input: { id: cart.id } })
          summary.completed++
          logger.info(`[thawani-reconcile] السلة ${cart.id}: جلسة مدفوعة بلا طلب ← أُتمّت طلباً`)
        } catch (e) {
          summary.failed++
          await release({ thawani_reconcile: { status: "paid_without_order", session_id: lock.session_id, error: (e as Error).message.slice(0, 200), at: Date.now() } })
          logger.error(`[thawani-reconcile] السلة ${cart.id}: مدفوعة (${s.total_amount / 1000} ر.ع) وتعذّر إنشاء الطلب — تحتاج استرداداً يدوياً: ${(e as Error).message}`)
        }
      } else if (s.payment_status === "cancelled" || Date.now() - Number(lock.at) >= LOCK_TTL_MS) {
        await release()
        summary.released++
      }
    } catch (e) {
      logger.warn(`[thawani-reconcile] ${cart.id}: ${(e as Error).message}`)
    }
  }
  if (summary.checked) logger.info(`[thawani-reconcile] ${JSON.stringify(summary)}`)
  return summary
}

export default async function thawaniReconcileJob(container: MedusaContainer) {
  if (process.env.THAWANI_ENABLED !== "true") return
  await reconcileThawani(container)
}

export const config = { name: "thawani-reconcile", schedule: "*/10 * * * *" }
