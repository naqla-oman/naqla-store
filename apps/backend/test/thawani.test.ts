/**
 * اختبار مزوّد ثواني بـ API محاكاة (لا شبكة): H3 العملة، H2 مطابقة المبلغ والمرجع، H2 الاسترداد.
 * التشغيل: npx tsx test/thawani.test.ts
 */
import assert from "node:assert/strict"
import ThawaniPaymentProvider from "../src/modules/thawani/service"

type Call = { method: string; path: string; body?: any }
let calls: Call[] = []
let session: any = {}
;(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const path = url.replace(/^.*\/api\/v1/, "")
  const method = init.method ?? "GET"
  calls.push({ method, path, body: init.body ? JSON.parse(init.body) : undefined })
  const ok = (data: any) => ({ ok: true, json: async () => ({ success: true, data }) })
  if (method === "POST" && path === "/checkout/session") return ok({ session_id: "sess_1", client_reference_id: JSON.parse(init.body).client_reference_id, payment_status: "unpaid", total_amount: JSON.parse(init.body).products[0].unit_amount, invoice: "INV1" })
  if (method === "GET" && path.startsWith("/checkout/session/")) return ok(session)
  if (method === "GET" && path.startsWith("/payments")) return ok([{ payment_id: "pay_9", status: "successful" }])
  if (method === "POST" && path === "/refunds") return ok({ refund_id: "ref_1", status: "successful" })
  return { ok: false, json: async () => ({ success: false, description: "unknown" }) }
}
const logger: any = { info() {}, warn() {}, error: (m: string) => (errors.push(m)) }
const errors: string[] = []
const p = new ThawaniPaymentProvider({ logger } as any, { secretKey: "sk", publishableKey: "pk", mode: "uat" } as any)

async function main() {
  // H3
  await assert.rejects(p.initiatePayment({ amount: 100, currency_code: "sar", data: { cart_id: "cart_1" } } as any), /الريال العُماني فقط/)
  const init = await p.initiatePayment({ amount: 27.65, currency_code: "omr", data: { cart_id: "cart_1" } } as any)
  assert.equal(init.data!.amount_baisa, 27650); assert.equal(init.data!.client_reference_id, "cart_1")
  console.log("✔ H3: SAR rejected, OMR session created (27650 baisa, ref cart_1)")

  // H2: مطابقة المبلغ والمرجع
  session = { session_id: "sess_1", client_reference_id: "cart_1", payment_status: "paid", total_amount: 27650, invoice: "INV1" }
  assert.equal((await p.authorizePayment({ data: init.data } as any)).status, "captured")
  session = { ...session, total_amount: 1000 }
  const bad = await p.authorizePayment({ data: init.data } as any)
  assert.equal(bad.status, "error"); assert.equal((bad.data as any).mismatch, true)
  session = { ...session, total_amount: 27650, client_reference_id: "cart_OTHER" }
  assert.equal((await p.authorizePayment({ data: init.data } as any)).status, "error")
  console.log("✔ H2: exact amount+ref → captured; amount 1.000 instead of 27.650 → error; other cart ref → error | logged:", errors.length)

  // H2: الاسترداد
  calls = []
  const paidData = { ...init.data, invoice: "INV1" }
  const r = await p.refundPayment({ amount: 27.65, data: paidData } as any)
  assert.equal((r.data as any).refund_id, "ref_1")
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path.split("?")[0]}`), ["GET /payments", "POST /refunds"])
  assert.equal(calls[1].body.payment_id, "pay_9")
  await assert.rejects(p.refundPayment({ amount: 10, data: paidData } as any), /الاسترداد الكامل فقط/)
  console.log("✔ H2: full refund → GET /payments then POST /refunds {payment_id: pay_9}; partial 10.000 rejected")
}
main().then(() => console.log("ALL PASSED")).catch((e) => { console.error("FAILED:", e.message); process.exit(1) })
