/** A2: توقيعات الصور — npx tsx test/sniff.test.ts */
import assert from "node:assert/strict"
import { sniffImage } from "../src/modules/safe-file/service"
const h = (hex: string) => Buffer.from(hex.replace(/\s/g, ""), "hex")
const cases: [string, Buffer, string | null][] = [
  ["PNG", h("89504E470D0A1A0A 0000000D49484452"), "image/png"],
  ["JPEG", h("FFD8FFE000104A464946"), "image/jpeg"],
  ["GIF89a", Buffer.from("GIF89a\x01\x00", "latin1"), "image/gif"],
  ["WebP", Buffer.concat([Buffer.from("RIFF"), h("24000000"), Buffer.from("WEBPVP8 ")]), "image/webp"],
  ["AVIF", Buffer.concat([h("00000020"), Buffer.from("ftypavif")]), "image/avif"],
  ["HTML named fake.png", Buffer.from("<script>alert(document.cookie)</script>"), null],
  ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), null],
  ["empty", Buffer.alloc(0), null],
]
for (const [name, buf, want] of cases) { assert.equal(sniffImage(buf), want, name); console.log(`✔ ${name} → ${want ?? "مرفوض"}`) }
console.log("ALL PASSED")
