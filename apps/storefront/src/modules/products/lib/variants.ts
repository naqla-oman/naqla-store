import { HttpTypes } from "@medusajs/types"
import { storeConfig } from "../../../store.config"

/**
 * خيارات المنتج بشكل عام: أي عدد من الخيارات المعرّفة في store.json → options
 * (المقاس/اللون للأزياء، الحجم للعطور، الوزن/النكهة للحلويات…).
 * خيارات Medusa v2.21 مشتركة بين المنتجات، لذلك نستخرج القيم من متغيّرات المنتج نفسه.
 */

type Variant = HttpTypes.StoreProductVariant
export type Selection = Record<string, string | undefined>

export type OptionDef = {
  key: string
  title: string
  type: "buttons" | "color"
  swatches?: Record<string, [string, string]>
  optionId: string
  values: string[]
}

export type VariantMatrix = {
  defs: OptionDef[]
  find: (sel: Selection) => Variant | undefined
  /** أكبر مخزون بين المتغيّرات المطابقة للاختيار (الجزئي أو الكامل) */
  stock: (sel: Selection) => number
  /** أول تركيبة متوفرة (أو الأولى إن نفد الكل) */
  initial: () => Selection
}

const valueOf = (v: Variant, optionId: string) => v.options?.find((o) => o.option_id === optionId)?.value

/** الكمية المتاحة لمتغيّر واحد (غير المُدار مخزونه أو المسموح طلبه مسبقاً = متوفر دائماً) */
export const availableQty = (v?: Variant) => {
  if (!v) return 0
  if (!v.manage_inventory || v.allow_backorder) return 99
  return Math.max(0, v.inventory_quantity ?? 0)
}

export function buildMatrix(product: HttpTypes.StoreProduct): VariantMatrix {
  const variants = product.variants ?? []
  const used = (product.options ?? []).filter((o) => variants.some((v) => valueOf(v, o.id)))

  // ترتيب store.options أولاً، ثم أي خيار أُضيف من اللوحة باسم آخر (يُعرض كأزرار)
  const conf = storeConfig.options
  const defs: OptionDef[] = used
    .map((o) => {
      const c = conf.find((x) => x.title === o.title)
      return {
        key: c?.key ?? o.id,
        title: o.title,
        type: c?.type ?? ("buttons" as const),
        swatches: c?.swatches,
        optionId: o.id,
        values: Array.from(new Set(variants.map((v) => valueOf(v, o.id)).filter(Boolean) as string[])),
      }
    })
    .sort((a, b) => {
      const ia = conf.findIndex((x) => x.key === a.key)
      const ib = conf.findIndex((x) => x.key === b.key)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

  const matches = (v: Variant, sel: Selection) => defs.every((d) => !sel[d.key] || valueOf(v, d.optionId) === sel[d.key])

  const find = (sel: Selection) =>
    variants.length === 1 ? variants[0] : defs.every((d) => sel[d.key]) ? variants.find((v) => matches(v, sel)) : undefined

  const stock = (sel: Selection) => variants.filter((v) => matches(v, sel)).reduce((s, v) => Math.max(s, availableQty(v)), 0)

  const selOf = (v?: Variant): Selection => Object.fromEntries(defs.map((d) => [d.key, v ? valueOf(v, d.optionId) : d.values[0]]))
  const initial = () => selOf(variants.find((v) => availableQty(v) > 0) ?? variants[0])

  return { defs, find, stock, initial }
}

/** سعر المتغيّر بعد الخصم وقبله (السعر الأصلي من price list أو من metadata.compare_at_price) */
export function variantPricing(product: HttpTypes.StoreProduct, v?: Variant) {
  const cheapest = [...(product.variants ?? [])]
    .filter((x) => x.calculated_price?.calculated_amount != null)
    .sort((a, b) => a.calculated_price!.calculated_amount! - b.calculated_price!.calculated_amount!)[0]
  const target = v?.calculated_price ? v : cheapest
  const cp = target?.calculated_price
  const price = cp?.calculated_amount ?? 0
  const listOriginal = cp?.original_amount ?? price
  const metaOld = Number((target?.metadata as any)?.compare_at_price ?? (product.metadata as any)?.compare_at_price) || 0
  const old = Math.max(listOriginal, metaOld)
  return {
    price,
    old: old > price ? old : null,
    currency: cp?.currency_code ?? storeConfig.currency,
  }
}
