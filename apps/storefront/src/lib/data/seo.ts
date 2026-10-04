"use server"

import { sdk } from "@lib/config"

/** وجهة تحويل 301 لمسار قديم (/products/old) إن وُجدت */
export async function findRedirect(path: string): Promise<string | null> {
  return sdk.client
    .fetch<{ to: string }>(`/store/seo-redirect`, { query: { path }, next: { revalidate: 300, tags: ["seo-redirects"] } })
    .then((r) => r.to)
    .catch(() => null)
}
