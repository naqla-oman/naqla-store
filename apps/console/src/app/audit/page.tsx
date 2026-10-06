import Shell from "@/components/shell"
import { q } from "@/lib/db"

export const dynamic = "force-dynamic"
export default async function AuditPage() {
  const rows = await q(`select at, admin_email, action, target, ok, ip from audit order by id desc limit 200`)
  return (
    <Shell active="/audit">
      <h1>سجل العمليات</h1>
      <div className="card"><table>
        <thead><tr><th>الوقت</th><th>المدير</th><th>العملية</th><th>الهدف</th><th>النتيجة</th><th>العنوان</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} data-testid="audit-row"><td><bdi>{new Date(r.at).toLocaleString("ar-OM-u-nu-latn")}</bdi></td><td><bdi>{r.admin_email ?? "—"}</bdi></td><td>{r.action}</td><td><bdi>{r.target ?? "—"}</bdi></td>
            <td><span className={`badge ${r.ok ? "running" : "failed"}`}>{r.ok ? "نجح" : "فشل"}</span></td><td><bdi>{r.ip}</bdi></td></tr>
        ))}</tbody>
      </table></div>
    </Shell>
  )
}
