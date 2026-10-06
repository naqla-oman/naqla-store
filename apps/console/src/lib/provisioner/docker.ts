import type { Driver } from "./types"

/**
 * سائق «docker» (الإنتاج) — هيكل يُستكمل ويُختبر عند النشر:
 * - المنفّذ (worker) وحده يملك صلاحية Docker؛ واجهة الويب تكتب المهام في القاعدة فقط.
 * - createFolder: نفس store:new (القوالب) داخل وحدة التخزين المشتركة.
 * - setup: قاعدة ومستخدم مستقلان على Postgres المشترك + الأسرار الأربعة، ثم توليد خدمتي
 *   backend-<slug>/storefront-<slug> في compose وموقع Caddy من قوالب فرع wip/deploy، ثم `docker compose up -d`.
 * - pause: موقع Caddy يحوّل إلى صفحة الصيانة ثم `docker compose stop`؛ resume عكسه.
 * - migrate: `docker compose run --rm backend-<slug> medusa db:migrate` ثم إعادة التشغيل بوسم الصورة الجديد.
 * - backup/restore: pg_dump/pg_restore عبر حاوية Postgres، ورفع النسخة إلى R2.
 * - remove: نسخة أخيرة ← أرشفة ← إزالة الخدمات والموقع والقاعدة.
 */
const todo = (op: string) => async (): Promise<never> => { throw new Error(`docker: «${op}» يُستكمل عند النشر (CONSOLE_DRIVER=local في التطوير)`) }
export const docker: Driver = {
  name: "docker",
  createFolder: todo("createFolder"), setup: todo("setup"), resetLink: todo("resetLink"), start: todo("start"), stop: todo("stop"),
  ready: async () => false, pause: todo("pause"), resume: todo("resume"), migrate: todo("migrate"), backup: todo("backup"),
  restore: todo("restore"), remove: todo("remove"), rollback: todo("rollback"), stats: async () => null, logs: async () => "",
}
