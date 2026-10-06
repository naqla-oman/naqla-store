/** أسماء مستعارة يحددها next.config حسب STORE (انظر client.js) */
declare module "@client/store.json" {
  const value: unknown
  export default value
}
declare module "@client/theme.css"
declare module "@client-font-display" {
  const font: { className: string; variable: string; style: { fontFamily: string } }
  export default font
}
declare module "@client-font-body" {
  const font: { className: string; variable: string; style: { fontFamily: string } }
  export default font
}
declare module "@client-font-latin" {
  const font: { className: string; variable: string; style: { fontFamily: string } }
  export default font
}

declare module "@naqla-themes/presets.json" {
  const v: {
    version: number
    palettes: { slug: string; name: string; use?: string; radius: Record<string, number>; light: Record<string, string>; dark: Record<string, string> }[]
    fonts: { slug: string; name: string; display: string; body: string; latin?: string; bodyLatin?: string }[]
  }
  export default v
}

declare module "@client/locales/en.json" {
  const v: Record<string, unknown>
  export default v
}
