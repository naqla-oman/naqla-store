import { createStore, json } from "@/lib/stores-api"
export const POST = (req: Request) => json(async () => createStore(await req.json().catch(() => ({}))))
