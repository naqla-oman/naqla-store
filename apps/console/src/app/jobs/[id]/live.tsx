"use client"
import { useEffect, useState } from "react"

const ST: Record<string, string> = { pending: "بانتظار", running: "قيد التنفيذ", done: "تم", failed: "فشل" }
/** سجل خطوات حيّ — يُحدَّث كل ثانيتين حتى تنتهي المهمة */
export default function Live({ id }: { id: number }) {
  const [j, setJ] = useState<any>(null)
  useEffect(() => {
    let stop = false
    const tick = async () => { const r = await fetch(`/api/jobs/${id}`); if (r.ok) { const d = await r.json(); setJ(d); if (["done", "failed"].includes(d?.status)) stop = true } if (!stop) setTimeout(tick, 2000) }
    tick(); return () => { stop = true }
  }, [id])
  if (!j) return <p className="muted">جارٍ التحميل…</p>
  return (
    <div className="grid" style={{ gap: 12 }} data-testid="job" data-status={j.status}>
      <div><span className={`badge ${j.status === "done" ? "running" : j.status === "failed" ? "failed" : "provisioning"}`} data-testid="job-status">{j.status === "done" ? "اكتملت" : j.status === "failed" ? "فشلت" : "قيد التنفيذ"}</span> {j.error && <span className="err">{j.error}</span>}
        {j.status === "done" && j.store_slug && <a href={`/stores/${j.store_slug}`} style={{ marginInlineStart: 10 }}>صفحة المتجر ←</a>}</div>
      {(j.steps ?? []).map((s: any, i: number) => (
        <div key={i} className="card" data-testid={`step-${s.key}`} data-status={s.status}>
          <b>{i + 1}. {s.title}</b> — <span className={`badge ${s.status === "done" ? "running" : s.status === "failed" ? "failed" : s.status === "running" ? "provisioning" : ""}`}>{ST[s.status] ?? s.status}</span>
          {s.log?.length > 0 && <pre className="log" style={{ marginTop: 8 }}>{s.log.slice(-25).join("\n")}</pre>}
        </div>
      ))}
    </div>
  )
}
