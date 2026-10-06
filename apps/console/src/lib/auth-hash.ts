import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

export function hashPassword(pw: string) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`
}
export function checkPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$")
  const a = scryptSync(pw, Buffer.from(salt, "hex"), 64), b = Buffer.from(hash, "hex")
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
}
