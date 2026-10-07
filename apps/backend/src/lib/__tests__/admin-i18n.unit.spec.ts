/**
 * لوحة التاجر باللغتين (المرحلة 5، DECISIONS 36–37):
 * كل رمز يرسله الخادم في ADMIN_ERRORS له نص في src/admin/i18n/json/{ar,en}.json (الرموز ديناميكية فلا يراها check:i18n)،
 * وصيغة الرسالة `code {params}` مع سياق المخاطبة للرموز المؤنثة، وطبقة en فوق إعداد المتجر بقواعد الواجهة.
 * التشغيل: pnpm --filter @naqla/backend test:unit   (STORE اختياري؛ الافتراضي أول متجر في clients/)
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { CLIENTS_DIR } from "../paths"
import { ADMIN_ERRORS, adminErrorMessage, clientIn, overlay } from "../admin-i18n"
import { client } from "../client"

const ADMIN_I18N = join(__dirname, "../../admin/i18n/json")
const load = (lang: string) => JSON.parse(readFileSync(join(ADMIN_I18N, `${lang}.json`), "utf8")).naqla
const savedStore = process.env.STORE

beforeAll(() => {
  process.env.STORE ||= readdirSync(CLIENTS_DIR).filter((d) => !d.startsWith("_")).sort()[0]
})
afterAll(() => {
  savedStore === undefined ? delete process.env.STORE : (process.env.STORE = savedStore)
})

describe("رموز رسائل لوحة التاجر", () => {
  it.each(["ar", "en"])("كل رمز في ADMIN_ERRORS مترجم في %s.json", (lang) => {
    const errors = load(lang).errors
    expect(Object.keys(ADMIN_ERRORS).filter((code) => typeof errors[code] !== "string")).toEqual([])
  })

  it("الرسالة رمز ومعاملات JSON، والمؤنث يحمل سياق المخاطبة", () => {
    expect(adminErrorMessage("vat_format")).toBe("vat_format")
    expect(adminErrorMessage("field_phone", { field: "contact.phone" })).toBe('field_phone {"field":"contact.phone"}')
    const voice = String((client() as any).voice ?? "neutral")
    expect(adminErrorMessage("payment_required")).toBe(`payment_required {"context":"${voice}"}`)
  })

  it("صيغة المؤنث العربية موجودة لكل رمز مؤنث", () => {
    const ar = load("ar").errors
    for (const code of ["email_invalid", "payment_required", "thawani_need_keys", "express_province_required", "governorate_required"]) expect(typeof ar[`${code}_f`]).toBe("string")
  })
})

describe("طبقة en لبيانات المتجر", () => {
  it("المصفوفات بالمفتاح إن وُجد في كل العناصر وإلا بالفهرس، والناقص يبقى عربياً", () => {
    const base = { tiers: [{ key: "a", name: "فضي" }, { key: "b", name: "ذهبي", perk: "توصيل" }], list: ["أ", "ب"] }
    expect(overlay(base, { tiers: [{ key: "b", name: "Gold" }], list: [null, "B"] })).toEqual({ tiers: [{ key: "a", name: "فضي" }, { key: "b", name: "Gold", perk: "توصيل" }], list: ["أ", "B"] })
    expect(overlay(base, { tiers: [{ name: "Silver" }] }).tiers[0].name).toBe("Silver")
  })

  it("العربية تعيد الإعداد نفسه، والرموز (المحافظات) لا تتغيّر بالترجمة", () => {
    expect(clientIn("ar")).toBe(client())
    const codes = (c: any) => (c.checkout?.governorates ?? []).map((g: any) => g.code)
    expect(codes(clientIn("en"))).toEqual(codes(client()))
  })
})
