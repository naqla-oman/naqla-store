/**
 * أسعار خيار التوصيل — مصدر واحد للبذرة الأولى وseed-02:
 * السعر الثابت للعملة والمنطقة، وسعر 0 عند item_total ≥ free_over إن وُجد.
 * (كان seed-02 يعيد إنشاء الخيار المقيّد بمحافظات بالسعر الثابت فقط فتسقط قاعدة المجاني.)
 */
export function shippingPrices(sh: { amount: number; free_over?: number }, currency: string, regionId: string) {
  return [
    { currency_code: currency, amount: sh.amount },
    { region_id: regionId, amount: sh.amount },
    ...(sh.free_over ? [{ region_id: regionId, amount: 0, rules: [{ attribute: "item_total", operator: "gte" as const, value: sh.free_over }] }] : []),
  ]
}
