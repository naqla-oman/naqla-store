import { revalidateTag } from "next/cache"
import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

/**
 * H1: إبطال الذاكرة المؤقتة من الخادم (مشترك Medusa عند تعديل المنتج/السعر/المخزون/القسم).
 * POST /api/revalidate  { tags: ["products", ...] }  مع الترويسة x-revalidate-secret
 */
const ALLOWED = new Set(["products", "categories", "collections", "regions", "tracking-config", "seo-redirects", "shipping-threshold"])
// وسوم تُستخدم بأسمائها مباشرة (لا global:)
const PLAIN = new Set(["tracking-config", "seo-redirects"])

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(new Uint8Array(Buffer.from(a)), new Uint8Array(Buffer.from(b)))

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET ?? ""
  const given = req.headers.get("x-revalidate-secret") ?? ""
  if (secret.length < 32 || !same(given, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { tags?: unknown }
  const tags = (Array.isArray(body.tags) ? body.tags : []).map(String).filter((t) => ALLOWED.has(t))
  for (const t of tags) revalidateTag(PLAIN.has(t) ? t : `global:${t}`)
  return NextResponse.json({ revalidated: tags })
}
