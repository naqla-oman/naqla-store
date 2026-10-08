/**
 * صور المنتجات إلى وحدة الملفات في Medusa.
 * البذرة تحفظ مسارات نسبية لصور العميل (images/... داخل clients/<STORE>/)، فلا تظهر في لوحة التحكم.
 * هذا السكربت يرفع كل صورة مرة واحدة ويستبدل المسار بالرابط الكامل من الخادم (<backend>/static/...)،
 * فتظهر في اللوحة وتُدار مثل أي صورة تُرفع منها لاحقاً. آمن للتكرار: يتخطى الروابط الكاملة.
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { existsSync, readFileSync } from "node:fs"
import { basename, extname, join } from "node:path"
import { clientDir } from "../lib/client"

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" }

export default async function product_images({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const files = container.resolve(Modules.FILE)
  const dir = clientDir()

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "thumbnail", "images.url", "images.rank"],
  })
  // كل ما ليس رابطاً كاملاً هو ملف في مجلد العميل
  const isLocal = (u?: string | null) => !!u && !/^https?:\/\//.test(u)
  const wanted = new Set<string>()
  for (const p of products as any[]) {
    if (isLocal(p.thumbnail)) wanted.add(p.thumbnail)
    for (const i of p.images ?? []) if (isLocal(i.url)) wanted.add(i.url)
  }
  if (!wanted.size) {
    logger.info("product-images: لا توجد صور بمسارات نسبية")
    return
  }

  const uploaded = new Map<string, string>()
  const missing: string[] = []
  for (const rel of wanted) {
    const path = join(dir, rel)
    if (!existsSync(path)) {
      missing.push(path)
      continue
    }
    const [file] = await files.createFiles([
      {
        filename: basename(rel),
        mimeType: MIME[extname(rel).toLowerCase()] ?? "application/octet-stream",
        content: readFileSync(path).toString("base64"),
        access: "public",
      },
    ])
    uploaded.set(rel, file.url)
  }

  // كتالوج مستورد بلا صوره المنزّلة: سطر واحد بالعدد وأمثلة بدل سطر لكل صورة
  if (missing.length) logger.warn(`product-images: ${missing.length} ملفاً غير موجود (مثل ${missing.slice(0, 3).join("، ")})`)

  let changed = 0
  for (const p of products as any[]) {
    const images = [...(p.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    if (!isLocal(p.thumbnail) && !images.some((i) => isLocal(i.url))) continue
    const map = (u: string) => (isLocal(u) ? uploaded.get(u) ?? u : u)
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: p.id },
        update: {
          thumbnail: p.thumbnail ? map(p.thumbnail) : undefined,
          images: images.map((i) => ({ url: map(i.url) })),
        },
      },
    })
    changed++
  }
  logger.info(`product-images: رُفعت ${uploaded.size} صورة وحُدّث ${changed} منتجاً`)
}
