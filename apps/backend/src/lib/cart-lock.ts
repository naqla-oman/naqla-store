import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * H2: قفل السلة أثناء الدفع عبر ثواني. تغيير السلة بعد التحويل (في تبويب آخر) كان يحذف الجلسة
 * فيُخصم المبلغ ولا يُنشأ طلب. القفل في metadata.payment_lock ويسقط تلقائياً بعد 30 دقيقة.
 */
export const LOCK_TTL_MS = 30 * 60_000
export type PaymentLock = { provider: "thawani"; session_id: string; amount_baisa?: number; at: number }

export const activeLock = (metadata: Record<string, any> | null | undefined): PaymentLock | null => {
  const l = metadata?.payment_lock as PaymentLock | undefined
  return l?.at && Date.now() - Number(l.at) < LOCK_TTL_MS ? l : null
}

/** يمنع أي تعديل على سلة مقفلة (الإضافة/التعديل/الحذف/الأكواد/العنوان/التوصيل) */
export async function blockLockedCart(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const id = (req.params as any)?.id
  if (!id) return next()
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "cart", fields: ["id", "metadata", "completed_at"], filters: { id } })
    const cart: any = data[0]
    if (cart && !cart.completed_at && activeLock(cart.metadata)) {
      return res.status(409).json({ type: "conflict", message: "الدفع عبر ثواني قيد التنفيذ لهذه السلة — أكمل الدفع أو ألغه قبل تعديلها" })
    }
  } catch {
    /* لا نمنع الخدمة إن تعذّرت القراءة */
  }
  next()
}
