import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize, sep } from "node:path"
import { NextRequest } from "next/server"
const { clientDir } = require("../../../../client")

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".gif": "image/gif",
}
// المسموح من مجلد العميل: الصور والأيقونات ونسخ الشعار والرمز وصورة المشاركة فقط (لا store.json ولا غيره)
// الشعار PNG/WebP أيضاً: معالج اللوحة يحفظ الشعار المرفوع logo.png
const ALLOWED = /^(images|icons)\/[^/]+$|^(logo[\w-]*\.(svg|png|webp)|symbol\.svg|og\.jpg)$/

/** يقدّم ملفات العميل من clients/<STORE>/ — /client-assets/images/hero.jpg */
export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = normalize((await params).path.join("/"))
  if (rel.startsWith("..") || rel.includes(`..${sep}`) || !ALLOWED.test(rel) || !TYPES[extname(rel).toLowerCase()]) {
    return new Response("Not found", { status: 404 })
  }
  const file = join(clientDir(), rel)
  try {
    const info = await stat(file)
    const body = await readFile(file)
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": TYPES[extname(rel).toLowerCase()],
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
