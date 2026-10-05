"use server"

import { sdk } from "@lib/config"

export type SearchResult = { ids: string[]; categories: { name: string; handle: string }[] }

/** H10: البحث العربي المُطبَّع من الخلفية (/store/search) — معرّفات مرتبة بالصلة + أقسام مقترحة */
export async function searchProducts(q: string): Promise<SearchResult> {
  return sdk.client
    .fetch<SearchResult>("/store/search", { query: { q: q.slice(0, 100) }, cache: "no-store" })
    .catch(() => ({ ids: [], categories: [] }))
}
