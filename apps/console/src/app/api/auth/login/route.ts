import { NextResponse } from "next/server"
import { COOKIE, cookieOptions, login } from "@/lib/auth"

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}))
  const r = await login(String(b.email ?? ""), String(b.password ?? ""), String(b.code ?? ""))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, r.token, cookieOptions())
  return res
}
