import presets from "@naqla-themes/presets.json"
import { FONT_CATALOG } from "../fonts/catalog"

/**
 * تبويب «الهوية»: CSS اللوحة المختارة بتحديد أعلى من theme.css العميل (html:root)،
 * فما لا تعرّفه اللوحة (الظلال، ارتفاعات الأزرار) يبقى من هوية العميل. مولَّد من presets.json
 * (مطابق لملفات themes/css حرفياً — تحقق في الاختبار).
 */
const vars = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(";")

export function paletteCss(slug?: string | null): string | null {
  const p = presets.palettes.find((x) => x.slug === slug)
  if (!p) return null
  const radius = Object.entries(p.radius).map(([k, v]) => `--r-${k}:${v}px`).join(";")
  return `html:root{${vars(p.light)};--hero-cta:var(--copper);--hero-cta-ink:var(--copper-ink);${radius};color-scheme:light}` +
    `html:root[data-theme="dark"]{${vars(p.dark)};color-scheme:dark}`
}

export function paletteThemeColor(slug?: string | null): string | null {
  return presets.palettes.find((x) => x.slug === slug)?.light.accent ?? null
}

/** زوج الخطوط ← متغيرات الواجهة من الكتالوج */
export function fontCss(slug?: string | null): string | null {
  const f = presets.fonts.find((x) => x.slug === slug)
  if (!f) return null
  const v = (name?: string) => (name && name !== "none" && FONT_CATALOG[name] ? `var(--ff-${name})` : null)
  const parts = [`--font-display:${v(f.display) ?? "inherit"}`, `--font-body:${v(f.body) ?? "inherit"}`, `--font-latin:${v(f.latin) ?? "inherit"}`]
  return `html:root{${parts.join(";")}}`
}
