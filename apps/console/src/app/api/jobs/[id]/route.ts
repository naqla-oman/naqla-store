import { q } from "@/lib/db"
import { admin, json } from "@/lib/stores-api"
export const GET = async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params
  return json(async () => { await admin(); const [j] = await q(`select id, store_slug, kind, status, steps, current, error, created_at, updated_at from jobs where id=$1`, [Number(id)]); return j ?? null })
}
