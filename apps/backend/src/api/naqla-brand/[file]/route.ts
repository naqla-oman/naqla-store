import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { client, clientDir } from "../../../lib/client"
import { ADMIN_BRAND_DIR } from "../../../lib/paths"

/**
 * ملفات هوية لوحة نقلة (عامة، تُطلب قبل الدخول أيضاً):
 *   /naqla-brand/<logo-horizontal.png|symbol.png|favicon-32.png|…>  ← admin-brand/public/naqla (هوية نقلة الثابتة)
 *   /naqla-brand/client-logo.png  ← شعار العميل الصغير من clients/<STORE>/icons/icon-192.png
 *   /naqla-brand/client.json      ← اسم متجر العميل
 */
const TYPES: Record<string, string> = { png: "image/png", svg: "image/svg+xml", ico: "image/x-icon", json: "application/json" }

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const file = String(req.params.file)
  if (file === "client.json") {
    const c = client()
    return res.json({ name: c.name, shortName: c.shortName, slug: c.slug })
  }
  const path =
    file === "client-logo.png"
      ? join(clientDir(), "icons", "icon-192.png")
      : /^[a-z0-9-]+\.(png|ico)$/.test(file)
        ? join(ADMIN_BRAND_DIR, "public", "naqla", file)
        : ""
  if (!path || !existsSync(path)) return res.status(404).json({ message: "غير موجود" })
  res.setHeader("Content-Type", TYPES[file.split(".").pop()!] ?? "application/octet-stream")
  res.setHeader("Cache-Control", "public, max-age=86400")
  res.send(readFileSync(path))
}
