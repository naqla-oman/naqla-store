import { MedusaError } from "@medusajs/framework/utils"
import { LocalFileService } from "@medusajs/medusa/file-local"

/**
 * M3: مزوّد الملفات المحلي مع قائمة سماح — الملفات العامة صور نقطية فقط.
 * HTML وSVG وغيرها كانت تُرفع وتُقدَّم من نطاق اللوحة (XSS مخزّن). الملفات الخاصة (CSV التصدير) مسموحة.
 */
const RASTER = new Map<string, string[]>([
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]],
  ["image/gif", ["gif"]],
  ["image/avif", ["avif"]],
])
const PRIVATE_OK = ["text/csv", "application/csv", "text/plain"]

class SafeLocalFileService extends LocalFileService {
  static identifier = "safe-local"

  async upload(file: Parameters<LocalFileService["upload"]>[0]) {
    const mime = String(file.mimeType ?? "").toLowerCase()
    const ext = String(file.filename ?? "").split(".").pop()?.toLowerCase() ?? ""
    const isPrivate = (file as any).access === "private"
    const ok = isPrivate ? PRIVATE_OK.includes(mime) || ext === "csv" : (RASTER.get(mime) ?? []).includes(ext)
    if (!ok) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `نوع الملف غير مسموح (${mime || "؟"} .${ext || "؟"}) — الصور فقط: JPG وPNG وWebP وGIF وAVIF`)
    }
    return super.upload(file)
  }
}

export default SafeLocalFileService
