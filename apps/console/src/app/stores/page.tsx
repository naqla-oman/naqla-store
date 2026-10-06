import Link from "next/link"
import Shell from "@/components/shell"
import { Status, when } from "@/components/status"
import { q } from "@/lib/db"

export const dynamic = "force-dynamic"
export default async function Stores() {
  const rows = await q(`select * from stores where status <> 'deleted' order by created_at desc`)
  return (
    <Shell active="/stores">
      <h1>المتاجر</h1>
      <div className="card"><table>
        <thead><tr><th>المتجر</th><th>الحالة</th><th>الإصدار</th><th>الدومين</th><th>الصحة</th><th>آخر نسخة</th></tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.slug} data-testid={`store-${s.slug}`}><td><Link href={`/stores/${s.slug}`}><b>{s.name}</b></Link><div className="muted"><bdi>{s.slug}</bdi></div></td>
            <td><Status s={s.status} /></td><td><bdi>{s.version ?? "—"}</bdi></td><td><bdi>{s.domain}</bdi></td>
            <td>{s.health === "ok" ? <span className="ok">/ready ✓</span> : s.health === "down" ? <span className="err">لا يستجيب</span> : "—"}</td><td>{when(s.last_backup_at)}</td></tr>
        ))}</tbody>
      </table>{!rows.length && <p className="muted">لا متاجر بعد — <Link href="/stores/new">أنشئ أول متجر</Link></p>}</div>
    </Shell>
  )
}
