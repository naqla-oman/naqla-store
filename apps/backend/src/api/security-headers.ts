import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ServerResponse } from "node:http"

/**
 * H8: ترويسات أمان للخلفية واللوحة. اللوحة لا تُضمَّن في إطار إطلاقاً (حماية من clickjacking).
 * Caddy يضيفها أيضاً في الإنتاج — هذه طبقة لا تعتمد على الوكيل.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

export function securityHeaders(_req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  res.removeHeader("X-Powered-By")
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
  next()
}

/**
 * منخفضة: ردود Medusa المبكرة (401 المصادقة المدمجة، 400 مفتاح النشر وJSON غير صالح) تُكتب قبل
 * أي وسيط من middlewares.ts فتخرج بلا ترويسات ومع X-Powered-By. نضيفها عند writeHead لكل رد — مرة واحدة.
 */
let installed = false
export function installSecurityHeaders() {
  if (installed) return
  installed = true
  const original = ServerResponse.prototype.writeHead
  ServerResponse.prototype.writeHead = function (this: ServerResponse, ...args: any[]) {
    if (!this.headersSent) {
      this.removeHeader("X-Powered-By")
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!this.hasHeader(k)) this.setHeader(k, v)
    }
    return (original as any).apply(this, args)
  } as typeof original
}
