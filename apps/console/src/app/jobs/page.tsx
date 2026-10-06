import Link from "next/link"
import Shell from "@/components/shell"
import { when } from "@/components/status"
import { q } from "@/lib/db"

export const dynamic = "force-dynamic"
export default async function Jobs() {
  const rows = await q(`select id, store_slug, kind, status, created_by, created_at, error from jobs order by id desc limit 100`)
  return (
    <Shell active="/jobs"><h1>مهام التجهيز</h1>
      <div className="card"><table><thead><tr><th>#</th><th>المتجر</th><th>المهمة</th><th>الحالة</th><th>بواسطة</th><th>الوقت</th></tr></thead>
        <tbody>{rows.map((j) => <tr key={j.id}><td><Link href={`/jobs/${j.id}`}>#{j.id}</Link></td><td><bdi>{j.store_slug}</bdi></td><td>{j.kind}</td>
          <td><span className={`badge ${j.status === "done" ? "running" : j.status === "failed" ? "failed" : "provisioning"}`}>{j.status}</span>{j.error && <div className="err">{j.error}</div>}</td><td><bdi>{j.created_by}</bdi></td><td>{when(j.created_at)}</td></tr>)}</tbody></table></div>
    </Shell>
  )
}
