/** منخفضة: ملخص الولاء من كل القيود — npx medusa exec ./test/loyalty-summary.exec.ts (CUSTOMER_ID) */
import { LOYALTY_MODULE } from "../src/modules/loyalty"
export default async function run({ container }: any) {
  const s: any = await container.resolve(LOYALTY_MODULE).summary(process.env.CUSTOMER_ID)
  console.log("SUMMARY", JSON.stringify({ available: s.available, confirmed: s.confirmed, tier: s.tier?.name, history: s.entries.length }))
}
