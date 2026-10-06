/**
 * منخفضة: الجمع العربي الصحيح (لا «1 منتجات») — فئات Intl.PluralRules('ar'):
 * zero/one/two/few (3–10)/many (11–99)/other (100+).
 */
type Forms = { one: string; two: string; few: string; many: string; other: string; zero?: string }
const RULES = new Intl.PluralRules("ar")
export function arCount(n: number, f: Forms) {
  const cat = RULES.select(n) as keyof Forms
  if (cat === "zero") return f.zero ?? `${n} ${f.other}`
  if (cat === "one") return f.one
  if (cat === "two") return f.two
  return `${n} ${f[cat] ?? f.other}`
}
export const products = (n: number) => arCount(n, { zero: "لا منتجات", one: "منتج واحد", two: "منتجان", few: "منتجات", many: "منتجاً", other: "منتج" })
export const pieces = (n: number) => arCount(n, { zero: "لا قطع", one: "قطعة واحدة", two: "قطعتان", few: "قطع", many: "قطعة", other: "قطعة" })
