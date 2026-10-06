// ملاحظات التحقق المستقل: crossCheck يرفض المخالفات الجديدة فقط، وnull للوحة/الخط = الافتراضي
// STORE=<slug> THAWANI_SECRET_KEY= THAWANI_PUBLISHABLE_KEY= npx tsx test/settings-crosscheck.test.ts
import assert from "node:assert/strict"
import { clientDefaults, deepMerge } from "../src/lib/client"
import { SCHEMA, crossCheck } from "../src/lib/store-settings-schema"
const def: any = clientDefaults()
const withThawani = deepMerge(def, { features: { thawani: true } })
// (أ) ثواني مفعّل بلا مفاتيح (حالة قائمة) + حفظ المخاطبة ← مقبول
assert.doesNotThrow(() => crossCheck(deepMerge(withThawani, { voice: "m" }), withThawani)); console.log("✔ voice save accepted while thawani on without keys")
// (ب) تفعيل ثواني وهو مطفأ وبلا مفاتيح ← مرفوض
const off = deepMerge(def, { features: { thawani: false } })
assert.throws(() => crossCheck(deepMerge(off, { features: { thawani: true } }), off), /ثواني يتطلب مفاتيحه/); console.log("✔ enabling thawani without keys rejected")
// (ج) مخالفة جديدة غير ثواني ما زالت تُرفض (إطفاء كل طرق الدفع)
assert.throws(() => crossCheck(deepMerge(withThawani, { features: { cod: false, whatsappOrder: false, thawani: false } }), withThawani), /طريقة دفع/); console.log("✔ new violation (no payment method) still rejected")
// (د) theme.palette = null ← اللوحة الافتراضية
assert.equal(SCHEMA["theme.palette"].check(null), def.theme.palette); assert.equal(SCHEMA["theme.font"].check(null), def.theme.font); console.log(`✔ palette/font null → default (${def.theme.palette} / ${def.theme.font})`)
console.log("ALL PASSED")
