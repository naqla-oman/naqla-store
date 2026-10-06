import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { client } from "./client"
import { decimalsOf } from "./money"

/**
 * منخفضة: سعر بمنازل أكثر من دقة العملة (8.5555 ر.ع) يُرفض — الريال لا يتجزأ دون البيسة.
 * يمسح جسم الطلب لكل كائن فيه amount (مع currency_code، أو عملة المتجر إن غابت).
 */
function bad(node: any, path: string, out: string[]) {
  if (Array.isArray(node)) return node.forEach((x, i) => bad(x, `${path}[${i}]`, out))
  if (!node || typeof node !== "object") return
  if (typeof node.amount === "number" && ("currency_code" in node || "variant_id" in node)) {
    const cur = node.currency_code ?? (client() as any).currency
    const d = decimalsOf(cur)
    if (Math.abs(Math.round(node.amount * 10 ** d) - node.amount * 10 ** d) > 1e-6) out.push(`${node.amount} ${String(cur).toUpperCase()} (الحد ${d} منازل)`)
  }
  for (const [k, v] of Object.entries(node)) if (v && typeof v === "object") bad(v, `${path}.${k}`, out)
}

export function validatePricePrecision(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const out: string[] = []
  bad(req.body, "body", out)
  if (out.length) {
    return res.status(400).json({ type: "invalid_data", message: `سعر بمنازل عشرية أكثر من دقة العملة: ${out.slice(0, 3).join("، ")}` })
  }
  next()
}
