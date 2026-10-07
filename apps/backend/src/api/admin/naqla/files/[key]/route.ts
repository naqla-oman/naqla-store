import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createReadStream, existsSync, readFileSync } from "node:fs"
import { sanitizeCsv } from "../../../../../lib/csv-safe"
import { join } from "node:path"
import { client } from "../../../../../lib/client"
import { PRIVATE_FILES_DIR } from "../../../../../lib/paths"
import { adminError } from "../../../../../lib/admin-i18n"

/**
 * H16: تنزيل الملفات الخاصة (التصدير) للأدمن المسجّل فقط — /admin/* محمي بمصادقة المستخدم.
 * أسماء الملفات الخاصة فقط (private-...)؛ لا مسارات ولا «..».
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const key = String(req.params.key ?? "")
  if (!/^private-[A-Za-z0-9._-]+$/.test(key) || key.includes("..")) throw adminError(MedusaError.Types.NOT_FOUND, "not_found")
  const file = join(PRIVATE_FILES_DIR, client().slug, key)
  if (!existsSync(file)) throw adminError(MedusaError.Types.NOT_FOUND, "not_found")
  res.setHeader("Content-Type", key.endsWith(".csv") ? "text/csv; charset=utf-8" : "application/octet-stream")
  res.setHeader("Content-Disposition", `attachment; filename="${key.replace(/^private-\d+-/, "")}"`)
  res.setHeader("Cache-Control", "no-store")
  // منخفضة: CSV المصدَّر يحتوي نصوص الزبونات — تُحيَّد الصيغ قبل التنزيل
  if (key.endsWith(".csv")) return res.send(sanitizeCsv(readFileSync(file, "utf8")))
  createReadStream(file).pipe(res)
}
