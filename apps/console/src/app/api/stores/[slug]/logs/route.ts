import { driver } from "@/lib/provisioner"
import { ApiError, admin, json } from "@/lib/stores-api"
export const GET = async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params
  // الرمز بنفس قاعدة التحقق (لا مسارات)
  return json(async () => { await admin(); if (!/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(slug)) throw new ApiError("رمز غير صالح"); return { logs: await driver().logs(slug, 120) } })
}
