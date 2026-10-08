import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { client } from "./client"
import { UPLOADS_DIR } from "./paths"
import { sniffImage } from "../modules/safe-file/service"
import { SettingsError } from "./store-settings-schema"

/**
 * تبويب «الهوية»: رفع الشعار والأيقونة — صور نقطية فقط (فحص البايتات)، ثم تحجيم تلقائي بـ sharp:
 * الشعار ≤600px، والأيقونة 192/512 + maskable بهامش أمان + أيقونة iPhone 180 على خلفية معتمة.
 * الملفات في UPLOADS_DIR/<slug>/brand وتُقدَّم من /static/<slug>/brand.
 */
const MAX = 5 * 1024 * 1024
export const brandUrlPrefix = () => `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static/${client().slug}/brand/`

export async function processBrandImage(kind: "logo" | "icon", dataUrl: string, background = "#ffffff") {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/.exec(dataUrl ?? "")
  if (!m) throw new SettingsError("image_invalid")
  const buf = Buffer.from(m[1], "base64")
  if (buf.length > MAX) throw new SettingsError("image_too_large")
  if (!sniffImage(buf)) throw new SettingsError("image_type")
  const meta = await sharp(buf).metadata()
  const w = meta.width ?? 0, h = meta.height ?? 0
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 10)
  const dir = join(UPLOADS_DIR, client().slug, "brand")
  mkdirSync(dir, { recursive: true })
  const put = (name: string, data: Buffer) => { writeFileSync(join(dir, name), data); return brandUrlPrefix() + name }
  const clear = { r: 0, g: 0, b: 0, alpha: 0 }

  if (kind === "logo") {
    if (Math.max(w, h) < 64) throw new SettingsError("logo_too_small")
    const out = await sharp(buf).resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true }).png().toBuffer()
    return { "brand.logo": put(`logo-${hash}.png`, out) }
  }
  if (Math.min(w, h) < 192) throw new SettingsError("icon_too_small")
  if (w / h > 1.25 || h / w > 1.25) throw new SettingsError("icon_not_square")
  const sq = (size: number) => sharp(buf).resize(size, size, { fit: "contain", background: clear }).png().toBuffer()
  // maskable: المحتوى داخل 80% (منطقة الأمان) على خلفية معتمة؛ وiPhone لا يدعم الشفافية
  const inner = await sharp(buf).resize(410, 410, { fit: "contain", background: clear }).png().toBuffer()
  const maskable = await sharp({ create: { width: 512, height: 512, channels: 4, background } }).composite([{ input: inner, gravity: "center" }]).png().toBuffer()
  const apple = await sharp(buf).resize(180, 180, { fit: "contain", background }).flatten({ background }).png().toBuffer()
  return {
    "icons.icon192": put(`icon-192-${hash}.png`, await sq(192)),
    "icons.icon512": put(`icon-512-${hash}.png`, await sq(512)),
    "icons.maskable": put(`icon-maskable-${hash}.png`, maskable),
    "icons.apple": put(`icon-apple-${hash}.png`, apple),
    "icons.svg": null,
  }
}
