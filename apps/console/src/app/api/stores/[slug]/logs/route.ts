import { driver } from "@/lib/provisioner"
import { admin, json } from "@/lib/stores-api"
export const GET = async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params
  return json(async () => { await admin(); return { logs: await driver().logs(slug, 120) } })
}
