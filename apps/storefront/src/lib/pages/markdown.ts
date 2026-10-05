/**
 * محوّل Markdown مصغّر وآمن لصفحات المتجر (عناوين، فقرات، قوائم، **غامق**، روابط).
 * كل النص يُهرَّب أولاً — لا HTML خام من الملفات. الروابط الداخلية فقط (/...) أو https.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function inline(s: string, prefix: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
      const safe = href.startsWith("/") ? `${prefix}${href}` : /^https:\/\//.test(href) ? href : "#"
      return `<a href="${safe}">${text}</a>`
    })
}

export function renderMarkdown(md: string, prefix = "") {
  const out: string[] = []
  let list: "ul" | "ol" | null = null
  const close = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (!line.trim()) { close(); continue }
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    const ul = line.match(/^\s*-\s+(.*)$/)
    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (h) { close(); out.push(`<h${h[1].length}>${inline(h[2], prefix)}</h${h[1].length}>`) }
    else if (ul || ol) {
      const kind = ul ? "ul" : "ol"
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind }
      out.push(`<li>${inline((ul ?? ol)![1], prefix)}</li>`)
    } else { close(); out.push(`<p>${inline(line, prefix)}</p>`) }
  }
  close()
  return out.join("\n")
}
