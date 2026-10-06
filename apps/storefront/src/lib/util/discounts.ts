import { storeConfig } from "../../store.config"

/**
 * منخفضة: سطر خصم لكل عرض بمبلغه الفعلي (كان سطراً واحداً يدمج كود الخصم مع امتياز المستوى،
 * وفي الدفع كان كل سطر كود يعرض الإجمالي كاملاً). المصدر: تعديلات الأسطر (items.adjustments) حسب الكود.
 * التوصيل له سطره الخاص (لا يدخل هنا).
 */
export type DiscountLine = { code: string; label: string; amount: number; auto: boolean }

const tierCodes = () => new Map(Object.entries((storeConfig.loyalty as any).tierPromoNames ?? {}) as [string, string][])

export function discountLines(items: any[] | null | undefined, promotions?: { code?: string | null; is_automatic?: boolean | null }[] | null): DiscountLine[] {
  const sums = new Map<string, number>()
  for (const it of items ?? []) for (const a of it.adjustments ?? []) {
    if (!a?.code) continue
    sums.set(a.code, (sums.get(a.code) ?? 0) + Number(a.amount || 0))
  }
  const autoByPromo = new Set((promotions ?? []).filter((p) => p.is_automatic && p.code).map((p) => String(p.code).toUpperCase()))
  const tiers = tierCodes()
  return Array.from(sums.entries())
    .filter(([, amount]) => amount > 0.0005)
    .map(([code, amount]) => {
      const up = code.toUpperCase()
      const auto = autoByPromo.has(up) || tiers.has(up)
      return { code, amount, auto, label: auto ? `امتياز ${tiers.get(up) ?? "عضويتك"}` : `خصم ${code}` }
    })
    .sort((a, b) => Number(a.auto) - Number(b.auto))
}
