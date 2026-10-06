const T: Record<string, string> = { provisioning: "يُجهَّز", running: "يعمل", paused: "موقوف", failed: "فشل", deleted: "محذوف" }
export const Status = ({ s }: { s: string }) => <span className={`badge ${s}`} data-testid="status">{T[s] ?? s}</span>
export const when = (d?: string | Date | null) => (d ? new Date(d).toLocaleString("ar-OM-u-nu-latn", { dateStyle: "short", timeStyle: "short" }) : "—")
