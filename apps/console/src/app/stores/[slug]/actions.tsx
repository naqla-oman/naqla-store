"use client"
import { useState } from "react"

/** عمليات المتجر — كلها مهام في الطابور؛ الحذف والاستعادة بتأكيد مكتوب (رمز المتجر) */
export default function Actions({ slug, status, backups }: { slug: string; status: string; backups: { id: number; kind: string; created_at: string; size: number }[] }) {
  const [err, setErr] = useState<string | null>(null)
  const [backupId, setBackupId] = useState<string>(backups[0] ? String(backups[0].id) : "")
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setErr(null)
    let confirm: string | null = null
    if (action === "delete" || action === "restore") {
      confirm = prompt(`عملية خطرة (${action === "delete" ? "حذف المتجر مع أرشفته" : "استعادة نسخة"}). للتأكيد اكتب رمز المتجر: ${slug}`)
      if (confirm === null) return
    }
    const r = await fetch(`/api/stores/${slug}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...extra, confirm }) })
    const b = await r.json().catch(() => ({}))
    if (r.ok) location.href = `/jobs/${b.jobId}`; else setErr(b.error ?? "تعذّرت العملية")
  }
  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="actions">
        {status === "running" && <button className="btn ghost" data-testid="a-pause" onClick={() => act("pause")}>إيقاف مؤقت (صيانة)</button>}
        {status === "paused" && <button className="btn" data-testid="a-resume" onClick={() => act("resume")}>استئناف</button>}
        <button className="btn ghost" data-testid="a-update" onClick={() => act("update")}>تحديث الإصدار</button>
        <button className="btn ghost" data-testid="a-backup" onClick={() => act("backup")}>نسخة احتياطية الآن</button>
        <button className="btn ghost" data-testid="a-reset" onClick={() => act("reset_link")}>رابط تعيين كلمة مرور جديد</button>
        <button className="btn danger" data-testid="a-delete" onClick={() => act("delete")}>حذف المتجر</button>
      </div>
      {backups.length > 0 && <div className="actions">
        <select value={backupId} onChange={(e) => setBackupId(e.target.value)} style={{ width: "auto" }} data-testid="a-backup-pick">
          {backups.map((b) => <option key={b.id} value={b.id}>{new Date(b.created_at).toLocaleString("ar-OM-u-nu-latn")} — {b.kind} ({Math.round(b.size / 1024)} KB)</option>)}
        </select>
        <button className="btn danger" data-testid="a-restore" onClick={() => act("restore", { backupId: Number(backupId) })}>استعادة هذه النسخة</button>
      </div>}
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  )
}
