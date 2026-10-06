/** الجمع عبر ICU plural في القاموس (العربية: zero/one/two/few/many/other) — تُمرَّر دالة الترجمة من المكوّن */
export type T = (key: string, vals?: Record<string, string | number>) => string
export const products = (t: T, n: number) => t("common.productsCount", { count: n })
export const pieces = (t: T, n: number) => t("common.piecesCount", { count: n })
