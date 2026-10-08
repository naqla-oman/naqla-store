/**
 * H1: إبطال ذاكرة الواجهة — طابور بوسوم مجمّعة (ثانيتان) ثم POST /api/revalidate بسر المتجر.
 * يستخدمه مشترك الأحداث ووسيط مسارات اللوحة التي لا تُطلق أحداثاً (قوائم الأسعار — M26).
 */
type Logger = { warn: (m: string) => void }
let pending = new Set<string>()
let timer: NodeJS.Timeout | null = null

export function queueRevalidate(tags: string[], logger?: Logger) {
  for (const t of tags) pending.add(t)
  if (timer || !pending.size) return
  timer = setTimeout(async () => {
    const batch = [...pending]
    pending = new Set()
    timer = null
    // في الحاويات: العنوان الداخلي للواجهة (http://storefront-<slug>:8000) بدل الدوران عبر Caddy والإنترنت
    const url = process.env.STOREFRONT_INTERNAL_URL || process.env.STOREFRONT_URL
    const secret = process.env.REVALIDATE_SECRET
    if (!url || !secret) return
    try {
      const res = await fetch(`${url}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
        body: JSON.stringify({ tags: batch }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) logger?.warn(`[revalidate] ${res.status} للوسوم ${batch.join(",")}`)
    } catch (e) {
      logger?.warn(`[revalidate] ${(e as Error).message}`)
    }
  }, 2000)
}

/** وسيط: بعد نجاح طلب اللوحة (2xx) يُطلب إبطال الوسوم */
export const revalidateAfter = (tags: string[]) => (_req: any, res: any, next: () => void) => {
  res.on("finish", () => {
    if (res.statusCode < 400) queueRevalidate(tags)
  })
  next()
}
