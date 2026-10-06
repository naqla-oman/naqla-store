import { admin, json, slugIssue, suggestSlug } from "@/lib/stores-api"
export const GET = (req: Request) => json(async () => {
  await admin()
  const u = new URL(req.url), slug = u.searchParams.get("slug")
  if (slug) return { slug, issue: await slugIssue(slug) }
  return { slug: await suggestSlug(u.searchParams.get("name") ?? "") }
})
