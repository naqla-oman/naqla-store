// قارئ xlsx صغير بلا اعتماديات: الملف zip فيه sharedStrings.xml وأوراق XML.
// يكفي لجداول المنتجات المُصدَّرة (نصوص وأرقام وصيغ محسوبة القيمة)؛ لا يقرأ التنسيق ولا التواريخ كتواريخ.
import { readFileSync } from "node:fs"
import { inflateRawSync } from "node:zlib"

/** ملفات الأرشيف من الدليل المركزي (أدق من الترويسات المحلية التي قد تُصفَّر أحجامها) */
function unzip(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error("ليس ملف xlsx صالحاً (لا دليل zip)")
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    files.set(name, () => (method === 0 ? raw : inflateRawSync(raw)).toString("utf8"))
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const unescape = (s) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[e.toLowerCase()])
/** نص العنصر مع كل مقاطع <t> (النص المنسّق يقسّمه Excel إلى مقاطع) */
const textOf = (xml) => unescape([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""))
const colIndex = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

/** الأوراق بأسمائها: { name, rows: (string|number|null)[][] } */
export function readXlsx(file) {
  const files = unzip(readFileSync(file))
  const get = (n) => files.get(n)?.() ?? ""
  const shared = [...get("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
  const rels = Object.fromEntries([...get("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
    m[0].match(/Id="([^"]+)"/)[1], m[0].match(/Target="([^"]+)"/)[1].replace(/^\/?(xl\/)?/, "xl/"),
  ]))
  return [...get("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const name = unescape(m[0].match(/name="([^"]*)"/)[1])
    const xml = get(rels[m[0].match(/r:id="([^"]+)"/)[1]])
    const rows = []
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = []
      for (const cell of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cell[1]
        const body = cell[2] ?? ""
        const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1]
        const type = attrs.match(/t="([^"]+)"/)?.[1]
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        let value = null
        if (type === "s") value = shared[Number(v)] ?? null
        else if (type === "inlineStr") value = textOf(body)
        else if (type === "str" || type === "e") value = v != null ? unescape(v) : null
        else if (type === "b") value = v === "1"
        else if (v != null) value = Number(v)
        row[ref ? colIndex(ref) : row.length] = value
      }
      rows.push(Array.from(row, (x) => x ?? null))
    }
    return { name, rows }
  })
}
