import Link from "next/link"
import Shell from "@/components/shell"
import { Status } from "@/components/status"
import { q } from "@/lib/db"
import { driver } from "@/lib/provisioner"

export const dynamic = "force-dynamic"
/** نظرة عامة: عدد المتاجر، طلبات ومبيعات اليوم لكل متجر (قراءة فقط)، تنبيهات الصحة */
export default async function Home() {
  const stores = await q(`select * from stores where status <> 'deleted' order by name`)
  const stats = await Promise.all(stores.map(async (s) => ({ s, st: s.status === "running" ? await driver().stats(s.slug) : null })))
  const alerts = stores.filter((s) => s.status === "failed" || (s.status === "running" && s.health === "down"))
  const total = stats.reduce((a, x) => ({ orders: a.orders + (x.st?.orders ?? 0), sales: a.sales + (x.st?.sales ?? 0) }), { orders: 0, sales: 0 })
  return (
    <Shell active="/">
      <h1>نظرة عامة</h1>
      <div className="grid g4">
        <div className="card kpi"><b data-testid="kpi-stores">{stores.length}</b><span>متاجر</span></div>
        <div className="card kpi"><b>{stores.filter((s) => s.status === "running").length}</b><span>تعمل</span></div>
        <div className="card kpi"><b data-testid="kpi-orders">{total.orders}</b><span>طلبات اليوم</span></div>
        <div className="card kpi"><b><bdi>{total.sales.toFixed(3)}</bdi></b><span>مبيعات اليوم (ر.ع)</span></div>
      </div>
      {alerts.length > 0 && <><h2>تنبيهات الصحة</h2><div className="card" data-testid="alerts">{alerts.map((s) => <div key={s.slug} className="err">⚠ {s.name}: {s.status === "failed" ? "فشل التجهيز" : "لا يستجيب /ready"}</div>)}</div></>}
      <h2>المتاجر اليوم</h2>
      <div className="card"><table><thead><tr><th>المتجر</th><th>الحالة</th><th>طلبات اليوم</th><th>مبيعات اليوم</th></tr></thead>
        <tbody>{stats.map(({ s, st }) => <tr key={s.slug} data-testid={`ov-${s.slug}`}><td><Link href={`/stores/${s.slug}`}>{s.name}</Link></td><td><Status s={s.status} /></td><td>{st?.orders ?? "—"}</td><td><bdi>{st ? st.sales.toFixed(3) : "—"}</bdi></td></tr>)}</tbody></table>
        {!stores.length && <p className="muted">لا متاجر بعد</p>}</div>
    </Shell>
  )
}
