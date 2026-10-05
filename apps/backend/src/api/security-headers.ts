import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * H8: ترويسات أمان للخلفية واللوحة. اللوحة لا تُضمَّن في إطار إطلاقاً (حماية من clickjacking).
 * Caddy يضيفها أيضاً في الإنتاج — هذه طبقة لا تعتمد على الوكيل.
 */
export function securityHeaders(_req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  res.removeHeader("X-Powered-By")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  next()
}
