import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { featureOn } from "./features"

/** مزوّد الدفع ← مفتاح تشغيله في store.json → features */
export const PROVIDER_FEATURE: Record<string, string> = {
  pp_cod_offline: "cod",
  pp_whatsapp_offline: "whatsappOrder",
  pp_thawani_thawani: "thawani",
}

/**
 * M12: مزوّدو الدفع لكل منطقة = المفعّل في store.json والمسجّل فعلاً في الخادم (ثواني يتطلب THAWANI_ENABLED ومفتاحيه).
 * يعمل مع كل إعداد وعند كل إقلاع إنتاجي — تفعيل ثواني بعد الإطلاق يظهر دون تدخّل يدوي.
 * مزوّدون خارج القائمة (أضافهم المسؤول يدوياً) يبقون كما هم.
 */
export async function syncPaymentProviders(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const registered = (await container.resolve(Modules.PAYMENT).listPaymentProviders({})).map((p) => p.id)
  const { data: regions } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "region", fields: ["id", "name", "payment_providers.id"] })
  const ours = Object.keys(PROVIDER_FEATURE)
  for (const r of regions as any[]) {
    const current: string[] = (r.payment_providers ?? []).map((p: any) => p.id)
    const wanted = [
      ...current.filter((id) => !ours.includes(id)),
      ...ours.filter((id) => featureOn(PROVIDER_FEATURE[id]) && registered.includes(id)),
    ]
    if (wanted.slice().sort().join() === current.slice().sort().join()) continue
    await updateRegionsWorkflow(container).run({ input: { selector: { id: r.id }, update: { payment_providers: wanted } } })
    logger.info(`payment-providers: ${r.name} → ${wanted.join(", ")}`)
  }
}
