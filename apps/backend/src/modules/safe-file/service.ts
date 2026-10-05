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

/** نفس فك المحتوى في مزوّد Medusa المحلي (base64 أولاً، وإلا utf8/binary) — نفحص البايتات التي ستُكتب فعلاً */
function decode(content: string, mime: string): Buffer {
  const b64 = Buffer.from(content, "base64")
  if (b64.toString("base64") === content) return b64
  const text = mime.startsWith("text/") || mime.includes("csv") || mime.includes("json") || mime.includes("xml")
  return Buffer.from(content, text ? "utf8" : "binary")
}

/** A2: التوقيع الفعلي للملف (magic bytes) — لا يكفي النوع المعلن والامتداد (HTML باسم fake.png ونوع image/png) */
export function sniffImage(buf: Buffer): string | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, k) => buf[i + k] === b)
  const str = (i: number, t: string) => buf.subarray(i, i + t.length).toString("latin1") === t
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg"
  if (str(0, "GIF87a") || str(0, "GIF89a")) return "image/gif"
  if (str(0, "RIFF") && str(8, "WEBP")) return "image/webp"
  if (str(4, "ftyp") && (str(8, "avif") || str(8, "avis"))) return "image/avif"
  return null
}

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
    if (!isPrivate) {
      const real = sniffImage(decode(String((file as any).content ?? ""), mime))
      if (real !== mime) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `محتوى الملف لا يطابق نوعه (${real ?? "ليس صورة"} بدل ${mime}) — ارفعي صورة فعلية`)
      }
    }
    return super.upload(file)
  }
}

export default SafeLocalFileService
