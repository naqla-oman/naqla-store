/**
 * منخفضة: تحييد حقن الصيغ في ملفات CSV المصدَّرة (أسماء وعناوين كتبتها الزبونات).
 * محلّل RFC 4180 صغير (اقتباس، فواصل وأسطر داخل الخلايا)، ثم خلية تبدأ بـ = + - @ Tab CR
 * تُسبَق بـ ' فيعرضها Excel نصاً. الأرقام السالبة الصريحة (-12.5) تبقى أرقاماً.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += c
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const NUMBER = /^-?\d+(\.\d+)?$/
export const neutralize = (v: string) => (/^[=+\-@\t\r]/.test(v) && !NUMBER.test(v) ? "'" + v : v)
const quote = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function sanitizeCsv(text: string): string {
  const bom = text.startsWith("\uFEFF") ? "\uFEFF" : ""
  return bom + parseCsv(bom ? text.slice(1) : text).map((r) => r.map((c) => quote(neutralize(c))).join(",")).join("\n") + "\n"
}
