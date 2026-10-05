/** M6: test_event_code على الأحداث الفعلية 24 ساعة فقط — npx tsx test/test-code.test.ts */
import assert from "node:assert/strict"
import { sendMeta, sendTikTok } from "../src/lib/server-events"
let last: any = null
;(globalThis as any).fetch = async (_u: string, init: any) => { last = JSON.parse(init.body); return { ok: true, text: async () => '{"code":0}' } }
const base = { meta_pixel_id: "1", meta_access_token: "t", tiktok_pixel_id: "2", tiktok_access_token: "t", meta_test_event_code: "TEST1", tiktok_test_event_code: "TEST2" }
const ev = { name: "purchase" as const, event_id: "purchase_x", value: 10, currency: "omr" }
const h = (hours: number) => new Date(Date.now() - hours * 3600_000)
async function main() {
  const cases: [string, any, any, boolean][] = [
    ["saved 1h ago, real purchase", { meta_test_event_code_at: h(1), tiktok_test_event_code_at: h(1) }, {}, true],
    ["saved 25h ago, real purchase", { meta_test_event_code_at: h(25), tiktok_test_event_code_at: h(25) }, {}, false],
    ["saved 25h ago, test button", { meta_test_event_code_at: h(25), tiktok_test_event_code_at: h(25) }, { test: true }, true],
    ["no saved time (old data), real", {}, {}, false],
  ]
  for (const [label, at, opts, want] of cases) {
    await sendMeta({ ...base, ...at }, ev, opts); const m = "test_event_code" in last
    await sendTikTok({ ...base, ...at }, ev, opts); const t = "test_event_code" in last
    assert.equal(m, want, `meta: ${label}`); assert.equal(t, want, `tiktok: ${label}`)
    console.log(`✔ ${label} → test_event_code ${want ? "sent" : "omitted"} (meta & tiktok)`)
  }
}
main().then(() => console.log("ALL PASSED")).catch((e) => { console.error("FAILED", e.message); process.exit(1) })
