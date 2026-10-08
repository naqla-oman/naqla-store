import { spawn } from "node:child_process"
import { join } from "node:path"
import pg from "pg"
import { local, ROOT } from "./local"
import type { Driver, Log } from "./types"

/**
 * سائق «docker» (الإنتاج): كل عملية عبر deploy/naqla.mjs — الأداة نفسها التي يستعملها المسؤول يدوياً (deploy/naqla.sh) —
 * فلا منطق نشر مكرَّر. يعمل في المنفّذ وحده (يملك مقبس Docker والمسارات المركّبة)؛ واجهة الويب بلا Docker (قرار 7):
 * فيها تُقرأ الإحصاءات من القاعدة مباشرة، والسجلات من المنفّذ أو الخادم.
 */
const NAQLA = join(ROOT, "deploy", "naqla.mjs")

function naqla(args: string[], log: Log = () => {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("node", [NAQLA, ...args], { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    // أسرار المخرجات (رابط/رمز التعيين، كلمات المرور) لا تُكتب في سجل الخطوة المحفوظ في القاعدة
    const take = (b: Buffer) => {
      const s = b.toString(); out += s
      for (const l of s.split("\n")) if (l.trim()) log(l.replace(/\x1b\[[0-9;]*m/g, "").replace(/(RESET_URL|RESET_TOKEN)=\S+/, "$1=••••").replace(/(PASSWORD|SECRET|TOKEN|KEY)=\S+/g, "$1=••••").slice(0, 300))
    }
    p.stdout.on("data", take); p.stderr.on("data", take)
    p.on("error", reject)
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`naqla ${args[0]} ${args[1] ?? ""} انتهى بالرمز ${code}`))))
  })
}

/** قاعدة المتجر على خادم Postgres نفسه بمستخدم اللوحة (naqla) — بلا قراءة ملفات البيئة */
const storeDbUrl = (slug: string) => {
  const u = new URL(process.env.CONSOLE_DATABASE_URL ?? "")
  u.pathname = `/naqla_${slug.replace(/-/g, "_")}`
  return u.toString()
}

export const docker: Driver = {
  name: "docker",
  // مجلد العميل من القالب والهوية: نفس أدوات المستودع (clients/ مركّب من الخادم)
  createFolder: (spec, log) => local.createFolder(spec, log),

  async setup(spec, log) {
    await naqla(["store", spec.slug, ...(spec.domain ? ["--domain", spec.domain] : []), "--admin-email", spec.email], log)
    return { backendPort: 0, storefrontPort: 0 }
  },

  async resetLink(slug, log) {
    const out = await naqla(["reset-link", slug], log)
    const url = (out.match(/RESET_URL=(\S+)/) ?? [])[1]
    if (!url) throw new Error("لم يُولَّد رابط تعيين كلمة المرور")
    return url
  },

  start: (slug, log) => naqla(["start", slug], log).then(() => {}),
  stop: (slug, log) => naqla(["stop", slug], log).then(() => {}),

  async ready(slug, timeoutMs = 0) {
    const deadline = Date.now() + timeoutMs
    do {
      if (await naqla(["ready", slug]).then(() => true, () => false)) return true
      if (timeoutMs) await new Promise((r) => setTimeout(r, 5000))
    } while (Date.now() < deadline)
    return false
  },

  pause: (slug, _name, log) => naqla(["pause", slug], log).then(() => {}),
  resume: (slug, log) => naqla(["resume", slug], log).then(() => {}),
  migrate: (slug, log) => naqla(["migrate", slug], log).then(() => {}),

  async backup(slug, kind, log) {
    const out = await naqla(["backup", slug, kind], log)
    const line = out.split("\n").reverse().find((l) => l.trim().startsWith("{"))
    if (!line) throw new Error("لم تُنشأ النسخة")
    return JSON.parse(line) as { file: string; size: number }
  },

  restore: (slug, file, log) => naqla(["restore", slug, file], log).then(() => {}),
  remove: (slug, log) => naqla(["remove", slug], log).then(() => {}),
  // تراجع إنشاء فاشل: الإزالة نفسها (الأرشيف لا يضر متجراً لم يُطلق)
  rollback: (slug, log) => naqla(["remove", slug], log).then(() => {}),

  async stats(slug) {
    if (!process.env.CONSOLE_DATABASE_URL) return null
    const c = new pg.Client({ connectionString: storeDbUrl(slug), statement_timeout: 5000 } as any)
    try {
      await c.connect()
      await c.query("set default_transaction_read_only = on")
      const { rows } = await c.query(`select count(*)::int as orders, coalesce(sum((s.totals->>'current_order_total')::numeric),0)::float as sales
        from "order" o join order_summary s on s.order_id=o.id and s.version=o.version and s.deleted_at is null
        where o.deleted_at is null and o.status not in ('canceled','draft') and o.is_draft_order=false and (o.created_at at time zone 'Asia/Muscat')::date = (now() at time zone 'Asia/Muscat')::date`)
      return rows[0]
    } catch { return null } finally { await c.end().catch(() => {}) }
  },

  // الويب بلا مقبس Docker: السجلات من الخادم
  logs: (slug, lines = 80) => naqla(["logs", slug, String(lines)]).catch(() => `السجلات على الخادم: deploy/naqla.sh logs ${slug}`),
}
