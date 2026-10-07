import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { stampOptionKeys } from "../lib/option-keys"

/** خيار جديد من اللوحة باسم عربي معروف (المقاس/اللون…) يحصل على مفتاحه الثابت فوراً */
export default async function onProductChange({ container }: SubscriberArgs<unknown>) {
  await stampOptionKeys(container).catch(() => {})
}
export const config: SubscriberConfig = { event: ["product.created", "product.updated", "product-option.created", "product-option.updated", "product-option-value.created"] }
