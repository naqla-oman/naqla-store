import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * تشفير الأسرار المحفوظة في القاعدة (AES-256-GCM). المفتاح من SETTINGS_ENCRYPTION_KEY إن وُجد،
 * وإلا مشتق من JWT_SECRET (48 بايت فريدة لكل متجر منذ C3). الصيغة: v1:<iv>:<tag>:<ciphertext> (base64url).
 */
const key = () => {
  const base = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!base || base.length < 32) throw new Error("مفتاح التشفير غير مضبوط (SETTINGS_ENCRYPTION_KEY أو JWT_SECRET)")
  return createHash("sha256").update(`${base}:naqla-store-settings`).digest()
}
const b64 = (b: Buffer) => b.toString("base64url")

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", key(), iv)
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return `v1:${b64(iv)}:${b64(c.getAuthTag())}:${b64(ct)}`
}

export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null
  const [v, iv, tag, ct] = sealed.split(":")
  if (v !== "v1" || !iv || !tag || !ct) return null
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  d.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8")
}

/** للعرض: آخر 4 أحرف فقط */
export const mask = (plain: string | null) => (plain ? `••••${plain.slice(-4)}` : null)
