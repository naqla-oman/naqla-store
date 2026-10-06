import { q } from "./db"
import { driver, type StoreSpec } from "./provisioner"
import type { Log } from "./provisioner/types"
import { sendStoreReady } from "./whatsapp"

/**
 * مهام التجهيز: خطوات مسمّاة، كل خطوة تُسجَّل حيّة (الحالة، الوقت، أسطر السجل).
 * الإنشاء يتراجع بنظافة عند الفشل؛ بقية المهام قابلة للاستئناف من الخطوة الفاشلة.
 */
export type Ctx = { job: any; spec: StoreSpec & Record<string, any>; state: Record<string, any>; log: Log }
type Step = { key: string; title: string; run: (c: Ctx) => Promise<void> }

const setStatus = (slug: string, status: string, extra: Record<string, unknown> = {}) => {
  const keys = Object.keys(extra)
  return q(`update stores set status=$2, updated_at=now()${keys.map((k, i) => `, ${k}=$${i + 3}`).join("")} where slug=$1`, [slug, status, ...Object.values(extra)])
}
const version = () => process.env.npm_package_version || "1.0.0"

export const JOBS: Record<string, { title: string; steps: Step[]; rollback?: (c: Ctx) => Promise<void>; done?: (c: Ctx) => Promise<void> }> = {
  create: {
    title: "إنشاء متجر",
    steps: [
      { key: "folder", title: "مجلد العميل من القالب والهوية", run: (c) => driver().createFolder(c.spec, c.log) },
      { key: "setup", title: "القاعدة والمستخدم والأسرار والترحيل والبذرة", run: async (c) => {
        const p = await driver().setup(c.spec, c.log)
        await q(`update stores set backend_port=$2, storefront_port=$3, version=$4 where slug=$1`, [c.spec.slug, p.backendPort, p.storefrontPort, version()])
      } },
      { key: "reset", title: "حساب المسؤول ورابط تعيين كلمة المرور", run: async (c) => { c.state.resetUrl = await driver().resetLink(c.spec.slug, c.log); c.log("وُلّد رابط التعيين (لا كلمة مرور في أي رسالة)") } },
      { key: "start", title: "التشغيل", run: (c) => driver().start(c.spec.slug, c.log) },
      { key: "ready", title: "فحص الجاهزية (/ready)", run: async (c) => {
        if (!(await driver().ready(c.spec.slug, 6 * 60_000))) throw new Error("لم يجهز المتجر خلال 6 دقائق")
        c.log("المتجر جاهز")
      } },
      { key: "notify", title: "رسالة واتساب للعميل", run: async (c) => {
        const [s] = await q(`select backend_port from stores where slug=$1`, [c.spec.slug])
        const panel = `http://localhost:${s.backend_port}/app`
        await sendStoreReady({ phone: c.spec.phone, name: c.spec.name, panel, reset: c.state.resetUrl }, c.log)
      } },
    ],
    rollback: async (c) => { await driver().rollback(c.spec.slug, c.log) },
    done: (c) => setStatus(c.spec.slug, "running", { health: "ok" }),
  },
  pause: { title: "إيقاف مؤقت", steps: [{ key: "pause", title: "صفحة الصيانة", run: (c) => driver().pause(c.spec.slug, c.spec.name, c.log) }], done: (c) => setStatus(c.spec.slug, "paused") },
  resume: {
    title: "استئناف",
    steps: [
      { key: "resume", title: "التشغيل", run: (c) => driver().resume(c.spec.slug, c.log) },
      { key: "ready", title: "فحص الجاهزية", run: async (c) => { if (!(await driver().ready(c.spec.slug, 6 * 60_000))) throw new Error("لم يجهز") } },
    ],
    done: (c) => setStatus(c.spec.slug, "running", { health: "ok" }),
  },
  update: {
    title: "تحديث الإصدار",
    steps: [
      { key: "backup", title: "نسخة احتياطية قبل التحديث", run: (c) => backupStep(c, "pre-update") },
      { key: "stop", title: "إيقاف", run: (c) => driver().stop(c.spec.slug, c.log) },
      { key: "migrate", title: "الترحيل", run: (c) => driver().migrate(c.spec.slug, c.log) },
      { key: "start", title: "التشغيل", run: (c) => driver().start(c.spec.slug, c.log) },
      { key: "ready", title: "فحص الجاهزية", run: async (c) => { if (!(await driver().ready(c.spec.slug, 6 * 60_000))) throw new Error("لم يجهز") } },
    ],
    done: (c) => setStatus(c.spec.slug, "running", { version: version(), health: "ok" }),
  },
  backup: { title: "نسخة احتياطية", steps: [{ key: "backup", title: "نسخ القاعدة والملفات", run: (c) => backupStep(c, "manual") }] },
  restore: {
    title: "استعادة نسخة",
    steps: [
      { key: "safety", title: "نسخة أمان قبل الاستعادة", run: (c) => backupStep(c, "pre-restore") },
      { key: "stop", title: "إيقاف", run: (c) => driver().stop(c.spec.slug, c.log) },
      { key: "restore", title: "استعادة القاعدة والملفات", run: async (c) => {
        const [b] = await q(`select file from backups where id=$1 and store_slug=$2`, [c.spec.backupId, c.spec.slug])
        if (!b) throw new Error("النسخة غير موجودة")
        await driver().restore(c.spec.slug, b.file, c.log)
      } },
      { key: "start", title: "التشغيل", run: (c) => driver().start(c.spec.slug, c.log) },
      { key: "ready", title: "فحص الجاهزية", run: async (c) => { if (!(await driver().ready(c.spec.slug, 6 * 60_000))) throw new Error("لم يجهز") } },
    ],
    done: (c) => setStatus(c.spec.slug, "running", { health: "ok" }),
  },
  reset_link: {
    title: "رابط تعيين كلمة مرور جديد",
    steps: [{ key: "reset", title: "توليد الرابط وإرساله", run: async (c) => {
      const url = await driver().resetLink(c.spec.slug, c.log)
      const [s] = await q(`select backend_port from stores where slug=$1`, [c.spec.slug])
      await sendStoreReady({ phone: c.spec.phone, name: c.spec.name, panel: `http://localhost:${s.backend_port}/app`, reset: url }, c.log)
    } }],
  },
  delete: {
    title: "حذف المتجر",
    steps: [
      { key: "final", title: "نسخة أخيرة", run: (c) => backupStep(c, "final") },
      { key: "remove", title: "إيقاف وأرشفة وحذف القاعدة", run: (c) => driver().remove(c.spec.slug, c.log) },
    ],
    done: (c) => setStatus(c.spec.slug, "deleted", { health: null }),
  },
}

async function backupStep(c: Ctx, kind: string) {
  const b = await driver().backup(c.spec.slug, kind, c.log)
  await q(`insert into backups (store_slug, file, size, kind) values ($1,$2,$3,$4)`, [c.spec.slug, b.file, b.size, kind])
  await q(`update stores set last_backup_at=now() where slug=$1`, [c.spec.slug])
}

/** إضافة مهمة للطابور (من واجهة الويب) — التنفيذ عند المنفّذ وحده */
export async function enqueue(kind: string, slug: string, input: Record<string, unknown>, by: string) {
  const def = JOBS[kind]
  if (!def) throw new Error("مهمة غير معروفة")
  const [busy] = await q(`select id from jobs where store_slug=$1 and status in ('queued','running')`, [slug])
  if (busy) throw new Error("للمتجر مهمة قيد التنفيذ")
  const steps = def.steps.map((s) => ({ key: s.key, title: s.title, status: "pending", log: [] as string[] }))
  const [j] = await q(`insert into jobs (store_slug, kind, input, steps, created_by) values ($1,$2,$3,$4,$5) returning id`, [slug, kind, JSON.stringify(input), JSON.stringify(steps), by])
  return Number(j.id)
}
