/**
 * «المنفّذ» — عملية منفصلة عن واجهة الويب: تقرأ طابور المهام من naqla_console وتنفّذها بالسائق.
 * وحدها تملك صلاحية التشغيل (وDocker في الإنتاج). تستأنف المهام المقطوعة عند إعادة التشغيل.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
for (const l of (existsSync(join(__dirname, "..", ".env.local")) ? readFileSync(join(__dirname, "..", ".env.local"), "utf8") : "").split("\n")) {
  const i = l.indexOf("="); if (i > 0 && !process.env[l.slice(0, i)]) process.env[l.slice(0, i)] = l.slice(i + 1)
}

async function main() {
  const { q } = await import("../src/lib/db")
  const { JOBS } = await import("../src/lib/jobs")
  const { driver } = await import("../src/lib/provisioner")
  const say = (m: string) => console.log(`[worker ${new Date().toISOString().slice(11, 19)}] ${m}`)
  // مهام قُطعت (إعادة تشغيل المنفّذ) ← تُستأنف من خطوتها الحالية
  // مهمة قُطعت عند «فحص الجاهزية»: عمليات المتجر ماتت مع المنفّذ ← تُعاد من خطوة التشغيل السابقة لا من الانتظار
  await q(`update jobs set current = greatest(current - 1, 0) where status='running' and steps->current->>'key' = 'ready'`)
  const resumed = await q(`update jobs set status='queued', updated_at=now() where status='running' returning id`)
  if (resumed.length) say(`استئناف ${resumed.length} مهمة مقطوعة`)
  say(`يعمل بالسائق ${driver().name}`)

  async function runJob(job: any) {
    const def = JOBS[job.kind]
    const steps: any[] = job.steps
    const [store] = await q(`select * from stores where slug=$1`, [job.store_slug])
    const spec = { ...(store ?? {}), ...(store?.meta ?? {}), ...job.input, slug: job.store_slug }
    const state: Record<string, any> = job.input.__state ?? {}
    const save = () => q(`update jobs set steps=$2, current=$3, input=$4, updated_at=now() where id=$1`, [job.id, JSON.stringify(steps), job.current, JSON.stringify({ ...job.input, __state: state })])
    say(`#${job.id} ${def.title} — ${job.store_slug}`)
    for (let i = job.current ?? 0; i < def.steps.length; i++) {
      job.current = i
      const st = steps[i]; st.status = "running"; st.started = new Date().toISOString(); st.log = st.log ?? []
      let pending = false
      const log = (line: string) => { st.log.push(line); if (st.log.length > 200) st.log.splice(0, st.log.length - 200); if (!pending) { pending = true; setTimeout(() => { pending = false; save() }, 700) } }
      await save()
      try {
        await def.steps[i].run({ job, spec, state, log })
        st.status = "done"; st.ended = new Date().toISOString(); await save()
      } catch (e: any) {
        st.status = "failed"; st.ended = new Date().toISOString(); log(`✖ ${e.message}`); await save()
        if (def.rollback) {
          const rb = { key: "rollback", title: "التراجع", status: "running", log: [] as string[] }
          steps.push(rb); await save()
          try { await def.rollback({ job, spec, state, log: (l) => rb.log.push(l) }); rb.status = "done" } catch (r: any) { rb.status = "failed"; rb.log.push(`✖ ${r.message}`) }
          await save()
        }
        await q(`update jobs set status='failed', error=$2, updated_at=now() where id=$1`, [job.id, e.message])
        if (store) await q(`update stores set status=$2, updated_at=now() where slug=$1`, [job.store_slug, job.kind === "create" ? "failed" : store.status])
        say(`#${job.id} فشل: ${e.message}`)
        return
      }
    }
    if (def.done) await def.done({ job, spec, state, log: () => {} })
    await q(`update jobs set status='done', current=$2, updated_at=now() where id=$1`, [job.id, def.steps.length])
    say(`#${job.id} اكتمل`)
  }

  let lastHealth = 0
  for (;;) {
    const [job] = await q(`update jobs set status='running', updated_at=now() where id = (select id from jobs where status='queued' order by id limit 1 for update skip locked) returning *`)
    if (job) { await runJob(job).catch((e) => say(`خطأ غير متوقع: ${e.message}`)); continue }
    if (Date.now() - lastHealth > 60_000) {
      lastHealth = Date.now()
      for (const s of await q(`select slug from stores where status='running'`)) {
        const okNow = await driver().ready(s.slug)
        await q(`update stores set health=$2 where slug=$1`, [s.slug, okNow ? "ok" : "down"])
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
