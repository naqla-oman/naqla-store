import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * C3: رمز JWT صالح التوقيع لا يكفي — يجب أن يكون مستخدم الأدمن موجوداً فعلاً (ولم يُحذف).
 * يمنع رمزاً مزوّراً بسر مسرّب، أو رمزاً لمستخدم حُذف بعد إصداره.
 */
export async function requireExistingAdmin(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const auth = (req as any).auth_context as { actor_type?: string; actor_id?: string } | undefined
  if (!auth || auth.actor_type !== "user") return next()
  // رمز بلا مستخدم (قبول دعوة): تتركه لقواعد Medusa في مساره
  if (!auth.actor_id) return next()
  try {
    const [user] = await req.scope.resolve(Modules.USER).listUsers({ id: auth.actor_id }, { take: 1, select: ["id"] })
    if (!user) return res.status(401).json({ type: "unauthorized", message: "Unauthorized" })
  } catch {
    return res.status(401).json({ type: "unauthorized", message: "Unauthorized" })
  }
  next()
}
