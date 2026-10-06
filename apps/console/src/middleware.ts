import { NextResponse, type NextRequest } from "next/server"

/** كل الصفحات تتطلب جلسة (التحقق الكامل في الخادم)، عدا الدخول وواجهة المصادقة */
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname
  if (p.startsWith("/login") || p.startsWith("/api/auth/") || p.startsWith("/_next") || p === "/favicon.ico") return NextResponse.next()
  if (!req.cookies.get("naqla_console_sid")) {
    return p.startsWith("/api/") ? NextResponse.json({ error: "غير مصرّح" }, { status: 401 }) : NextResponse.redirect(new URL("/login", req.url))
  }
  return NextResponse.next()
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] }
