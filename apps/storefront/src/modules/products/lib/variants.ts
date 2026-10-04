import { HttpTypes } from "@medusajs/types"
import { storeConfig } from "../../../store.config"

/**
 * خيارات Medusa v2.21 مشتركة بين المنتجات (خيار «المقاس» يحمل قيم كل المنتجات)،
 * لذلك نستخرج المقاسات والألوان من متغيّرات المنتج نفسه لا من قيم الخيار.
 */

type Variant = HttpTypes.StoreProductVariant

const { size: SIZE_TITLE, color: COLOR_TITLE } = storeConfig.product.optionTitles

export type VariantMatrix = {
  sizeOptionId?: string
  colorOptionId?: string
  sizes: string[]
  colors: string[]
  find: (size?: string, color?: string) => Variant | undefined
  stock: (size?: string, color?: string) => number
}

const valueOf = (v: Variant, optionId?: string) =>
  optionId ? v.options?.find((o) => o.option_id === optionId)?.value : undefined

/** الكمية المتاحة لمتغيّر واحد (غير المُدار مخزونه أو المسموح طلبه مسبقاً = متوفر دائماً) */
export const availableQty = (v?: Variant) => {
  if (!v) return 0
  if (!v.manage_inventory || v.allow_backorder) return 99
  return Math.max(0, v.inventory_quantity ?? 0)
}

export function buildMatrix(product: HttpTypes.StoreProduct): VariantMatrix {
  const variants = product.variants ?? []
  const sizeOptionId = product.options?.find((o) => o.title === SIZE_TITLE)?.id
  const colorOptionId = product.options?.find((o) => o.title === COLOR_TITLE)?.id

  const uniq = (optionId?: string) =>
    Array.from(new Set(variants.map((v) => valueOf(v, optionId)).filter(Boolean) as string[]))

  const sizes = uniq(sizeOptionId)
  const colors = uniq(colorOptionId)

  const find = (size?: string, color?: string) =>
    variants.find(
      (v) =>
        (!sizeOptionId || !sizes.length || valueOf(v, sizeOptionId) === size) &&
        (!colorOptionId || !colors.length || valueOf(v, colorOptionId) === color)
    ) ?? (variants.length === 1 ? variants[0] : undefined)

  // مخزون مقاس عبر كل الألوان إن لم يُحدد لون، أو لتركيبة محددة
  const stock = (size?: string, color?: string) => {
    if (color !== undefined) return availableQty(find(size, color))
    return variants
      .filter((v) => !sizeOptionId || valueOf(v, sizeOptionId) === size)
      .reduce((s, v) => Math.max(s, availableQty(v)), 0)
  }

  return { sizeOptionId, colorOptionId, sizes, colors, find, stock }
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
