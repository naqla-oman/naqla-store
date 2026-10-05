/** M31: ذاكرة قصيرة لمسارات اللوحة الثقيلة (60 ثانية) — لكل عملية خادم */
const store = new Map<string, { at: number; value: unknown }>()
export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
  const value = await fn()
  store.set(key, { at: Date.now(), value })
  return value
}
