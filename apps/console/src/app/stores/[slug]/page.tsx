import Link from "next/link"
import { notFound } from "next/navigation"
import Shell from "@/components/shell"
import { Status, when } from "@/components/status"
import { q } from "@/lib/db"
import { driver } from "@/lib/provisioner"
import Actions from "./actions"

export const dynamic = "force-dynamic"
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [s] = await q(`select * from stores where slug=$1 and status <> 'deleted'`, [slug])
  if (!s) notFound()
  const [backups, jobs, logs] = await Promise.all([
    q(`select id, kind, created_at, size from backups where store_slug=$1 order by id desc limit 20`, [slug]),
    q(`select id, kind, status, created_at from jobs where store_slug=$1 order by id desc limit 10`, [slug]),
    driver().logs(slug, 40),
  ])
  return (
    <Shell active="/stores">
      <h1>{s.name} <Status s={s.status} /></h1>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><b><bdi>{s.version ?? "—"}</bdi></b><span>الإصدار</span></div>
        <div className="card kpi"><b style={{ fontSize: 15 }}><bdi>{s.domain}</bdi></b><span>الدومين</span></div>
        <div className="card kpi"><b style={{ fontSize: 18 }}>{s.health === "ok" ? "✓" : s.health === "down" ? "✖" : "—"}</b><span>/ready</span></div>
        <div className="card kpi"><b style={{ fontSize: 15 }}>{when(s.last_backup_at)}</b><span>آخر نسخة</span></div>
      </div>
      <div className="card grid" style={{ gap: 12 }}>
        <div className="actions">
          {s.backend_port && <a className="btn" href={`http://localhost:${s.backend_port}/app`} target="_blank" rel="noreferrer">فتح لوحة المتجر</a>}
          {s.storefront_port && <a className="btn ghost" href={`http://localhost:${s.storefront_port}`} target="_blank" rel="noreferrer">فتح المتجر</a>}
        </div>
        <Actions slug={slug} status={s.status} backups={backups.map((b) => ({ ...b, id: Number(b.id), size: Number(b.size) }))} />
      </div>
      <h2>المهام</h2>
      <div className="card"><table><tbody>{jobs.map((j) => <tr key={j.id}><td><Link href={`/jobs/${j.id}`}>#{j.id}</Link></td><td>{j.kind}</td><td><span className={`badge ${j.status === "done" ? "running" : j.status === "failed" ? "failed" : "provisioning"}`}>{j.status}</span></td><td>{when(j.created_at)}</td></tr>)}</tbody></table></div>
      <h2>سجلات مختصرة</h2>
      <pre className="log" data-testid="store-logs">{logs || "لا سجلات"}</pre>
    </Shell>
  )
}
