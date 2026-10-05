import { MedusaError } from "@medusajs/framework/utils"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

/**
 * C8: مسارات ثابتة لا تعتمد على process.cwd().
 * بعد `medusa build` يعمل الخادم من .medusa/server فتنكسر المسارات النسبية (.env، clients/، admin-brand، الصور).
 * الجذر: NAQLA_ROOT (للحاويات) أو أقرب مجلد أعلى هذا الملف فيه pnpm-workspace.yaml.
 */
function findRoot(): string {
  if (process.env.NAQLA_ROOT) return resolve(process.env.NAQLA_ROOT)
  let dir = __dirname
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  throw new MedusaError(MedusaError.Types.INVALID_DATA, "NAQLA_ROOT غير محدد ولم يُعثر على pnpm-workspace.yaml فوق مجلد الخادم")
}

export const NAQLA_ROOT = findRoot()
export const BACKEND_DIR = join(NAQLA_ROOT, "apps", "backend")
export const CLIENTS_DIR = process.env.CLIENTS_DIR ? resolve(process.env.CLIENTS_DIR) : join(NAQLA_ROOT, "clients")
export const ADMIN_BRAND_DIR = join(BACKEND_DIR, "admin-brand")
/** الصور المرفوعة خارج .medusa (لا يحذفها البناء) — في الإنتاج volume دائم */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ? resolve(process.env.UPLOADS_DIR) : join(BACKEND_DIR, "static")
/** H16: الملفات الخاصة (تصدير الطلبات والمنتجات — فيها بيانات الزبائن) خارج أي مسار مُقدَّم؛ تُنزَّل عبر مسار للأدمن فقط */
// خارج apps/backend: مراقب medusa develop يعيد التشغيل عند ملف جديد داخله فيقطع التصدير في منتصفه
export const PRIVATE_FILES_DIR = process.env.PRIVATE_FILES_DIR ? resolve(process.env.PRIVATE_FILES_DIR) : join(NAQLA_ROOT, ".private-files")
