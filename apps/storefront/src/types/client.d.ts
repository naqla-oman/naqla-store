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
