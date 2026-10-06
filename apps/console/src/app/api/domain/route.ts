import { checkDomain, json } from "@/lib/stores-api"
export const GET = (req: Request) => json(async () => checkDomain(new URL(req.url).searchParams.get("domain") ?? ""))
