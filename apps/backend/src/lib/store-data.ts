import { readFileSync } from "node:fs"
import { join } from "node:path"

/** بيانات العميل من data/<STORE_DATA>.json (تُقرأ مرة واحدة) */
let cache: any
export function storeData(): {
  name: string
  name_en?: string
  country: string
  currency: string
  order_prefix?: string
  location?: { name?: string; address?: string; city?: string }
} {
  if (!cache) {
    const file = process.env.STORE_DATA || "layan"
    cache = JSON.parse(readFileSync(join(process.cwd(), "data", `${file}.json`), "utf-8")).store
  }
  return cache
}

export const orderNumber = (displayId?: number | null) =>
  `${storeData().order_prefix ?? "#"}${String(displayId ?? "").padStart(4, "0")}`
