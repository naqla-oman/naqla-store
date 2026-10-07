import type { HttpTypes } from "@medusajs/types"
import { storeConfig, type StoreConfig } from "@/store.config"

type Item = Pick<HttpTypes.StoreCartLineItem, "variant_title" | "product_title" | "title" | "product_id"> & {
  variant?: { options?: { id?: string; value?: string; option_value_id?: string | null }[] | null } | null
  product?: { title?: string | null } | null
}

/**
 * لقطات السلة/الطلب (variant_title, product_title) مخزّنة بالعربية؛ مع valueMap (id ← نص مترجم من
 * /store/naqla/translations) تُبنى التسمية من قيم الخيارات الفعلية. للعربية valueMap فارغة فتبقى اللقطات كما هي.
 */
export function variantLabel(item: Item, sep = " · ", valueMap: Record<string, string> = {}) {
  const opts = item.variant?.options
  if (opts?.length) {
    const vals = opts.map((o) => valueMap[o.option_value_id ?? o.id ?? ""] ?? o.value ?? "").filter(Boolean)
    if (vals.length) return vals.join(sep)
  }
  return item.variant_title ?? ""
}

export function itemTitle(item: Item, valueMap: Record<string, string> = {}) {
  return (item.product_id && valueMap[item.product_id]) || item.product?.title || item.product_title || item.title || ""
}

/**
 * اسم المحافظة والولاية بلغة الصفحة: العنوان يُخزَّن بالعربية (province = رمز المحافظة، city = الولاية)،
 * وتُستبدل بنظيرتها في إعداد اللغة الحالية بالفهرس نفسه.
 */
export function addressLabels(sc: StoreConfig, province?: string | null, city?: string | null) {
  const gi = storeConfig.checkout.governorates.findIndex((x) => x.code === province || x.name === province)
  if (gi < 0) return { gov: province ?? "", wil: city ?? "" }
  const ar = storeConfig.checkout.governorates[gi], loc = sc.checkout.governorates[gi] ?? ar
  const wi = city ? (ar.wilayats ?? []).indexOf(city) : -1
  return { gov: loc.name, wil: wi >= 0 ? loc.wilayats?.[wi] ?? city ?? "" : city ?? "" }
}
