import { client } from "./client"

/** M21: وزن المتغيّر بالجرام: weight المنتج ← وزن قسمه ← الافتراضي (store.json → shippingWeights) */
export function weightFor(p: { weight?: number; category?: string } | undefined) {
  const w = (client() as any).shippingWeights ?? {}
  return Number(p?.weight ?? (p?.category ? w.categories?.[p.category] : undefined) ?? w.default ?? 500)
}
