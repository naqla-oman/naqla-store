import { HttpTypes } from "@medusajs/types"
import { storeConfig } from "../../store.config"

/**
 * نص بديل للصور من الاسم والقسم وقيم اللون (أو الخيار الأول إن لم يوجد لون):
 * «عباءة كلاسيكية — عباءات — أسود، رملي»
 */
export function productAlt(p: Pick<HttpTypes.StoreProduct, "title" | "categories" | "options" | "variants">, locale = "ar") {
  const colorTitle = storeConfig.options.find((o) => o.type === "color")?.title
  const opt = (p.options ?? []).find((o) => o.title === colorTitle) ?? (p.options ?? [])[0]
  const values = opt
    ? Array.from(new Set((p.variants ?? []).map((v) => v.options?.find((x) => x.option_id === opt.id)?.value).filter(Boolean) as string[])).slice(0, 4)
    : []
  const sep = locale === "ar" ? "، " : ", " // i18n-ok: فاصل القائمة حسب اللغة
  return [p.title, p.categories?.[0]?.name, values.join(sep)].filter(Boolean).join(" — ")
}
