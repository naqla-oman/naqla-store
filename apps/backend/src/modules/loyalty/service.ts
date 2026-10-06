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
    // C1: Medusa يمرّر مع خيارات الوحدة إعداداته الداخلية (منها database.clientUrl بكلمة المرور).
    // نحتفظ بالحقول المعروفة فقط، فلا يمكن أن يتسرّب غيرها من أي مكان يقرأ options.
    this.opts_ = {
      pointsPerUnit: Number(options.pointsPerUnit ?? DEFAULTS.pointsPerUnit),
      redeemPoints: Number(options.redeemPoints ?? DEFAULTS.redeemPoints),
      redeemValue: Number(options.redeemValue ?? DEFAULTS.redeemValue),
      tiers: (options.tiers ?? DEFAULTS.tiers).map((t) => ({ key: String(t.key), name: String(t.name), min: Number(t.min) })),
    }
  }

  get options() {
    return this.opts_
  }

  /** النقاط المستحقة لطلب: مجموع المنتجات بعد الخصم (بلا توصيل) × النقاط لكل ر.ع */
  async pointsFor(itemTotal: number): Promise<number> {
    return Math.max(0, Math.floor(Number(itemTotal) * this.opts_.pointsPerUnit))
  }

  async summary(customerId: string) {
    // منخفضة: المجاميع من كل القيود (أعمدة خفيفة فقط) — كانت من آخر 200 فتسقط النقاط القديمة من الرصيد والمستوى
    const all = await this.listLoyaltyEntries({ customer_id: customerId }, { select: ["points", "status", "kind"], take: 1_000_000 })
    // السجل المعروض للزبونة: الأحدث فقط
    const entries = await this.listLoyaltyEntries({ customer_id: customerId }, { order: { created_at: "DESC" }, take: 50 })
    const sum = (f: (e: (typeof all)[number]) => boolean) => all.filter(f).reduce((s, e) => s + Number(e.points), 0)
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
