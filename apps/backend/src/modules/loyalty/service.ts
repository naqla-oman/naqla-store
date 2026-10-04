import { MedusaService } from "@medusajs/framework/utils"
import { LoyaltyEntry } from "./models/loyalty-entry"

export type LoyaltyOptions = {
  pointsPerUnit?: number
  redeemPoints?: number
  redeemValue?: number
  tiers?: { key: string; name: string; min: number }[]
}

export const DEFAULTS: Required<LoyaltyOptions> = {
  pointsPerUnit: 10, // نقاط لكل ر.ع
  redeemPoints: 500,
  redeemValue: 5, // ر.ع
  tiers: [
    { key: "silver", name: "فضية", min: 0 },
    { key: "gold", name: "ذهبية", min: 1000 },
    { key: "diamond", name: "ماسية", min: 2500 },
  ],
}

class LoyaltyModuleService extends MedusaService({ LoyaltyEntry }) {
  protected opts_: Required<LoyaltyOptions>

  constructor(container: Record<string, unknown>, options: LoyaltyOptions = {}) {
    // @ts-ignore
    super(...arguments)
    this.opts_ = { ...DEFAULTS, ...options }
  }

  get options() {
    return this.opts_
  }

  /** النقاط المستحقة لطلب: مجموع المنتجات بعد الخصم (بلا توصيل) × النقاط لكل ر.ع */
  async pointsFor(itemTotal: number): Promise<number> {
    return Math.max(0, Math.floor(Number(itemTotal) * this.opts_.pointsPerUnit))
  }

  async summary(customerId: string) {
    const entries = await this.listLoyaltyEntries({ customer_id: customerId }, { order: { created_at: "DESC" }, take: 200 })
    const sum = (f: (e: (typeof entries)[number]) => boolean) => entries.filter(f).reduce((s, e) => s + e.points, 0)
    const available = Math.max(0, sum((e) => e.status === "available"))
    const pending = sum((e) => e.kind === "earn" && e.status === "pending")
    // المستوى من مجموع النقاط المؤكَّدة (بعد التوصيل) — لا تنقصه الاستبدالات ولا تدخله المعلّقة
    const confirmed = sum((e) => e.kind === "earn" && e.status === "available")
    const tiers = this.opts_.tiers
    const tier = [...tiers].reverse().find((t) => confirmed >= t.min) ?? tiers[0]
    const next = tiers.find((t) => t.min > confirmed) ?? null
    return { available, pending, confirmed, tier, next, entries, rules: this.opts_ }
  }
}

export default LoyaltyModuleService
