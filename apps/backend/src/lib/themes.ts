import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { clientDir } from "./client"
import { NAQLA_ROOT } from "./paths"

/**
 * لوحات نقلة الجاهزة وأزواج الخطوط (themes/presets.json — مصدر واحد للخادم والواجهة).
 * اللوحة الافتراضية للعميل تُكتشف بمطابقة ألوان theme.css مع اللوحات؛ لا تطابق ← «هوية مخصصة» (custom).
 */
export type Palette = { slug: string; name: string; use?: string; radius: Record<string, number>; light: Record<string, string>; dark: Record<string, string> }
export type FontPair = { slug: string; name: string; display: string; body: string; latin?: string }
let presets: { palettes: Palette[]; fonts: FontPair[] } | null = null
export function themePresets() {
  if (!presets) presets = JSON.parse(readFileSync(join(NAQLA_ROOT, "themes", "presets.json"), "utf8"))
  return presets!
}

/** متغيرات اللوحة كما في ملفات css (مع الاسمين الثابتين hero-cta) */
export function paletteVars(p: Palette) {
  const light: Record<string, string> = { ...Object.fromEntries(Object.entries(p.light).map(([k, v]) => [`--${k}`, v])), "--hero-cta": "var(--copper)", "--hero-cta-ink": "var(--copper-ink)" }
  for (const [k, v] of Object.entries(p.radius)) light[`--r-${k}`] = `${v}px`
  const dark = Object.fromEntries(Object.entries(p.dark).map(([k, v]) => [`--${k}`, v]))
  return { light, dark }
}

function cssVars(css: string) {
  const out: Record<"light" | "dark", Record<string, string>> = { light: {}, dark: {} }
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const mode = /dark/.test(sel) ? "dark" : "light"
    for (const [, k, v] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[mode][k] = v.trim().toLowerCase()
  }
  return out
}

/** لوحة العميل الافتراضية: كل ألوان اللوحة (عدا hero-cta) تطابق theme.css → slug، وإلا custom */
export function detectPalette(): string {
  const file = join(clientDir(), "theme.css")
  if (!existsSync(file)) return "custom"
  const cur = cssVars(readFileSync(file, "utf8"))
  for (const p of themePresets().palettes) {
    const v = paletteVars(p)
    const same = (["light", "dark"] as const).every((m) =>
      Object.entries(v[m]).filter(([k]) => !k.startsWith("--hero-cta")).every(([k, val]) => cur[m][k] === val.toLowerCase())
    )
    if (same) return p.slug
  }
  return "custom"
}

/** زوج الخطوط الافتراضي من store.json → fonts */
export function detectFont(fonts: { display?: string; body?: string; latin?: string } | undefined): string {
  const f = themePresets().fonts.find((x) => x.display === fonts?.display && x.body === fonts?.body && (x.latin ?? "none") === (fonts?.latin ?? "none"))
  return f?.slug ?? "custom"
}
