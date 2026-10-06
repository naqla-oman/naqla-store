import { sdk } from "@lib/config"
import { storeConfig } from "../../store.config"

/**
 * M19: حد التوصيل المجاني من قاعدة Medusa الفعلية (مصدر واحد)، مخزَّن 5 دقائق.
 * store.json احتياطي فقط إن تعذّر الطلب. null = لا توصيل مجاني.
 */
export type ShippingConfig = { free_over: number | null; governorates: string[] | null; express_provinces: string[] | null }

/** تبويب «التوصيل»: الحد والمحافظات المفعّلة من Medusa (null للمحافظات = كلها) */
export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    return await sdk.client.fetch<ShippingConfig>("/store/naqla/shipping-threshold", {
      next: { revalidate: 300, tags: ["global:shipping-threshold"] },
      cache: "force-cache",
    })
  } catch {
    return { free_over: storeConfig.freeShippingOver ?? null, governorates: null, express_provinces: null }
  }
}

export async function getFreeShippingOver(): Promise<number | null> {
  return (await getShippingConfig()).free_over
}
