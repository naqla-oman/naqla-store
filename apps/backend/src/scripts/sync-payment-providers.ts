/** M12: npx medusa exec ./src/scripts/sync-payment-providers.ts — يُشغَّل مع store:setup وعند كل إقلاع إنتاجي */
import { MedusaContainer } from "@medusajs/framework"
import { syncPaymentProviders } from "../lib/payment-providers"

export default async function run({ container }: { container: MedusaContainer }) {
  await syncPaymentProviders(container)
}
