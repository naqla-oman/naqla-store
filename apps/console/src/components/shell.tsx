import Link from "next/link"
import { requireAdmin } from "@/lib/auth"

/** إطار اللوحة: القائمة الجانبية بهوية نقلة + المحتوى (يتطلب جلسة) */
export default async function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  const admin = await requireAdmin()
  const nav = [["/", "نظرة عامة"], ["/stores", "المتاجر"], ["/stores/new", "متجر جديد"], ["/jobs", "مهام التجهيز"], ["/audit", "سجل العمليات"]]
  return (
    <div className="shell">
      <nav className="side" aria-label="القائمة">
        <div className="brand"><i>ن</i> نقلة</div>
        {nav.map(([href, label]) => <Link key={href} href={href} className={active === href ? "on" : ""}>{label}</Link>)}
        <div className="who"><bdi>{admin.email}</bdi><form action="/api/auth/logout" method="post"><button className="btn ghost" style={{ marginTop: 8, color: "#C9D6E2" }}>خروج</button></form></div>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
