import { createHmac, randomBytes } from "node:crypto"

/** TOTP (RFC 6238) — SHA-1، 6 أرقام، 30 ثانية: متوافق مع Google Authenticator */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
export function newSecret(): string {
  const bytes = randomBytes(20)
  let bits = "", out = ""
  for (const b of bytes) bits += b.toString(2).padStart(8, "0")
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}
function decode(s: string): Buffer {
  let bits = ""
  for (const ch of s.replace(/=+$/, "").toUpperCase()) { const v = B32.indexOf(ch); if (v < 0) continue; bits += v.toString(2).padStart(5, "0") }
  const out: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(out)
}
export function codeAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step))
  const h = createHmac("sha1", decode(secret)).update(msg).digest()
  const o = h[h.length - 1] & 0xf
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, "0")
}
export const stepNow = (t = Date.now()) => Math.floor(t / 30000)
/** يعيد الخطوة المطابقة (±1) أو null — والمستدعي يرفض خطوة ≤ آخر خطوة مستخدمة (منع الإعادة) */
export function verify(secret: string, code: string, t = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null
  for (const d of [0, -1, 1]) if (codeAt(secret, stepNow(t) + d) === code) return stepNow(t) + d
  return null
}
export const otpauthUri = (secret: string, email: string) =>
  `otpauth://totp/${encodeURIComponent("Naqla Console")}:${encodeURIComponent(email)}?secret=${secret}&issuer=Naqla&digits=6&period=30`
