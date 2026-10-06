import { json, storeAction } from "@/lib/stores-api"
export const POST = async (req: Request, ctx: { params: Promise<{ slug: string; action: string }> }) => {
  const { slug, action } = await ctx.params
  return json(async () => storeAction(slug, action, await req.json().catch(() => ({}))))
}
