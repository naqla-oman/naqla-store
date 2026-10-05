/** M13: نافذة التوصيل السريع بتوقيت مسقط (UTC+4) — STORE=<slug> npx tsx test/express.test.ts */
// يتطلب STORE=<slug> لعميل قائمة أيام عطلته الجمعة (مثل القالب) — بلا اسم عميل في الكود
if (!process.env.STORE) { console.error("STORE=<slug> مطلوب"); process.exit(1) }
import assert from "node:assert/strict"
const { expressOpen } = require("../src/workflows/hooks/cart-stock")
// 2026-10-08 الخميس، 2026-10-09 الجمعة، 2026-10-10 السبت — الأوقات UTC (مسقط = +4)
const cases: [string, boolean, string][] = [
  ["2026-10-08T09:59:00Z", true, "الخميس 1:59 ظهراً"],
  ["2026-10-08T10:59:00Z", true, "الخميس 2:59 عصراً"],
  ["2026-10-08T11:00:00Z", false, "الخميس 3:00 عصراً"],
  ["2026-10-08T17:00:00Z", false, "الخميس 9 مساءً"],
  ["2026-10-09T06:00:00Z", false, "الجمعة 10 صباحاً"],
  ["2026-10-10T06:00:00Z", true, "السبت 10 صباحاً"],
  ["2026-10-08T21:30:00Z", false, "الجمعة 1:30 فجراً (مساء الخميس UTC)"],
]
for (const [iso, want, label] of cases) { assert.equal(expressOpen(new Date(iso)), want, label); console.log(`✔ ${label} → ${want ? "متاح" : "مغلق"}`) }
console.log("ALL PASSED")
