import { NextResponse } from "next/server"
import { COOKIE, audit, currentAdmin, logout } from "@/lib/auth"

export async function POST(req: Request) {
  const a = await currentAdmin()
  await logout()
  if (a) await audit("logout", { email: a.email })
  const res = NextResponse.redirect(new URL("/login", req.url), 303)
  res.cookies.delete(COOKIE)
  return res
}
