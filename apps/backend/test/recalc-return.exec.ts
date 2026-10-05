/** M9: إعادة حساب نقاط طلب بعد إرجاع — npx medusa exec ./test/recalc-return.exec.ts (ORDER_ID من البيئة) */
import { recalcPointsAfterReturnWorkflow } from "../src/workflows/loyalty-return"
export default async function run({ container }: any) {
  const { result } = await recalcPointsAfterReturnWorkflow(container).run({ input: { order_id: process.env.ORDER_ID! } })
  console.log("RECALC", JSON.stringify(result))
}
