import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createReadStream, existsSync } from "node:fs"
import { join } from "node:path"
import { client } from "../../../../../lib/client"
import { PRIVATE_FILES_DIR } from "../../../../../lib/paths"

/**
 * H16: تنزيل الملفات الخاصة (التصدير) للأدمن المسجّل فقط — /admin/* محمي بمصادقة المستخدم.
 * أسماء الملفات الخاصة فقط (private-...)؛ لا مسارات ولا «..».
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const key = String(req.params.key ?? "")
  if (!/^private-[A-Za-z0-9._-]+$/.test(key) || key.includes("..")) throw new MedusaError(MedusaError.Types.NOT_FOUND, "غير موجود")
  const file = join(PRIVATE_FILES_DIR, client().slug, key)
  if (!existsSync(file)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "غير موجود")
  res.setHeader("Content-Type", key.endsWith(".csv") ? "text/csv; charset=utf-8" : "application/octet-stream")
  res.setHeader("Content-Disposition", `attachment; filename="${key.replace(/^private-\d+-/, "")}"`)
  res.setHeader("Cache-Control", "no-store")
  createReadStream(file).pipe(res)
}
