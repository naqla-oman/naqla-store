import { sdk } from "@lib/config"
import { storeConfig } from "../../store.config"

/**
 * M19: حد التوصيل المجاني من قاعدة Medusa الفعلية (مصدر واحد)، مخزَّن 5 دقائق.
 * store.json احتياطي فقط إن تعذّر الطلب. null = لا توصيل مجاني.
 */
export async function getFreeShippingOver(): Promise<number | null> {
  try {
    const { free_over } = await sdk.client.fetch<{ free_over: number | null }>("/store/naqla/shipping-threshold", {
      next: { revalidate: 300, tags: ["global:shipping-threshold"] },
      cache: "force-cache",
    })
    return free_over
  } catch {
    return storeConfig.freeShippingOver ?? null
  }
}
