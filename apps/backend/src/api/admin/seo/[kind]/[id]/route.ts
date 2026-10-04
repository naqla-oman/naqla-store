import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

type Body = { seo_title?: string; seo_description?: string; handle?: string }

/**
 * POST /admin/seo/:kind/:id — حفظ عنوان السيو والوصف والرابط (kind = product | category).
 * تغيير الرابط يُنشئ تحويل 301 تلقائياً عبر مشترك seo-*-handle (يعمل لأي تعديل).
 */
export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const { kind, id } = req.params
  if (kind !== "product" && kind !== "category") throw new MedusaError(MedusaError.Types.INVALID_DATA, "kind غير معروف")
  const handle = req.body.handle?.trim().toLowerCase()
  if (handle !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "الرابط: حروف لاتينية صغيرة وأرقام وشرطات فقط")
  }
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: kind === "product" ? "product" : "product_category", fields: ["id", "metadata"], filters: { id },
  })
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "غير موجود")
  // تحديث جزئي: الحقل غير المرسل يبقى كما هو (النص الفارغ يحذفه)
  const metadata: Record<string, unknown> = { ...((data[0] as any).metadata ?? {}) }
  if ("seo_title" in req.body) metadata.seo_title = (req.body.seo_title ?? "").trim().slice(0, 70) || null
  if ("seo_description" in req.body) metadata.seo_description = (req.body.seo_description ?? "").trim().slice(0, 170) || null
  const update = { metadata, ...(handle ? { handle } : {}) }
  if (kind === "product") await updateProductsWorkflow(req.scope).run({ input: { selector: { id }, update } })
  else await updateProductCategoriesWorkflow(req.scope).run({ input: { selector: { id }, update } })
  res.json({ ok: true })
}
