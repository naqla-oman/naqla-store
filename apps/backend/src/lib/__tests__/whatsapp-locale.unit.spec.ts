/**
 * لغة إشعارات واتساب للطلب (المرحلة 4، DECISIONS 31) بـ Meta API محاكاة (لا شبكة):
 * طلب إنجليزي بلا قالب WHATSAPP_TPL_*_EN معتمد يُرسل بالقالب العربي ويُسجَّل ذلك —
 * سواء جاء التفعيل من .env (WHATSAPP_ENABLED) أو من مفاتيح «إعدادات المتجر» في اللوحة.
 * التشغيل: pnpm --filter @naqla/backend test:unit   (STORE اختياري؛ الافتراضي أول متجر في clients/)
 */
import { readdirSync } from "node:fs"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CLIENTS_DIR } from "../paths"
import { setSealedSecrets, whatsappEnabled } from "../credentials"
import { seal } from "../secret-box"
import { notifyOrder, type OrderNotice } from "../order-notifications"
import WhatsappNotificationService from "../../modules/whatsapp-notification/service"

const ENV_KEYS = ["WHATSAPP_ENABLED", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TPL_ORDER_PLACED_EN"]
const saved = Object.fromEntries([...ENV_KEYS, "STORE", "JWT_SECRET", "NODE_ENV"].map((k) => [k, process.env[k]]))

type Sent = { name: string; lang: string; params: string[] }
let sent: Sent[] = []
const logs: string[] = []
const logger: any = { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m), error: (m: string) => logs.push(m) }
const realFetch = globalThis.fetch

beforeAll(() => {
  process.env.STORE ||= readdirSync(CLIENTS_DIR).filter((d) => !d.startsWith("_")).sort()[0]
  process.env.JWT_SECRET ||= "x".repeat(48) // لتشفير مفاتيح اللوحة في الاختبار فقط
  process.env.NODE_ENV = "test"
  ;(globalThis as any).fetch = async (_url: string, init: any) => {
    const t = JSON.parse(init.body).template
    sent.push({ name: t.name, lang: t.language.code, params: t.components[0].parameters.map((p: any) => p.text) })
    return { ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) }
  }
})
afterAll(() => {
  globalThis.fetch = realFetch
  setSealedSecrets({})
  for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v)
})
beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k]
  setSealedSecrets({})
  sent = []
  logs.length = 0
})

/** الخدمة كما يبنيها medusa-config: options من .env لحظة الإقلاع */
const service = () =>
  new WhatsappNotificationService({ logger } as any, {
    enabled: process.env.WHATSAPP_ENABLED === "true",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    otpTemplate: "otp_tpl",
    orderTemplates: { order_placed: "tpl_order_placed", merchant_new_order: "tpl_merchant_new_order" },
    orderTemplatesEn: { order_placed: process.env.WHATSAPP_TPL_ORDER_PLACED_EN },
  })

const run = async (kind: OrderNotice = "order_placed") => {
  const svc = service()
  const container: any = {
    resolve: (k: string) => {
      if (k === ContainerRegistrationKeys.LOGGER) return logger
      if (k === ContainerRegistrationKeys.QUERY)
        return { graph: async () => ({ data: [{ id: "order_1", display_id: 5, total: 28.5, currency_code: "omr", locale: "en-US", shipping_address: { phone: "+96891234567", first_name: "Sara" }, shipping_methods: [] }] }) }
      if (k === Modules.NOTIFICATION) return { createNotifications: async (n: any) => svc.send(n) }
      throw new Error(`unexpected ${k}`)
    },
  }
  await notifyOrder(container, "order_1", kind, `k${Math.random()}`)
}
const fellBack = () => logs.some((l) => l.includes("لا قالب إنجليزي معتمد") && l.includes("WHATSAPP_TPL_ORDER_PLACED_EN"))

describe("واتساب: لغة إشعار الطلب والرجوع إلى القالب العربي", () => {
  it("التفعيل من .env بلا قالب EN ← القالب العربي مع سجل الرجوع", async () => {
    Object.assign(process.env, { WHATSAPP_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "env-token", WHATSAPP_PHONE_NUMBER_ID: "111" })
    expect(whatsappEnabled()).toBe(true)
    await run()
    expect(sent).toHaveLength(1)
    expect([sent[0].name, sent[0].lang]).toEqual(["tpl_order_placed", "ar"])
    expect(sent[0].params).toContain("28.500 ر.ع")
    expect(fellBack()).toBe(true)
  })

  it("مفاتيح «إعدادات المتجر» فقط (بلا WHATSAPP_ENABLED) بلا قالب EN ← القالب العربي مع سجل الرجوع", async () => {
    setSealedSecrets({ "whatsapp.accessToken": seal("panel-token"), "whatsapp.phoneNumberId": seal("222") })
    expect(whatsappEnabled()).toBe(true)
    await run()
    expect(sent).toHaveLength(1)
    expect([sent[0].name, sent[0].lang]).toEqual(["tpl_order_placed", "ar"])
    expect(fellBack()).toBe(true)
    expect(logs.join("\n")).not.toContain("لم يُرسل")
  })

  it("قالب EN معتمد ← يُرسل بالإنجليزية (OMR) بلا رجوع", async () => {
    setSealedSecrets({ "whatsapp.accessToken": seal("panel-token"), "whatsapp.phoneNumberId": seal("222") })
    process.env.WHATSAPP_TPL_ORDER_PLACED_EN = "tpl_order_placed_en"
    await run()
    expect([sent[0]?.name, sent[0]?.lang]).toEqual(["tpl_order_placed_en", "en"])
    expect(sent[0].params).toContain("28.500 OMR")
    expect(fellBack()).toBe(false)
  })

  it("merchant_new_order عربي دائماً لطلب إنجليزي", async () => {
    setSealedSecrets({ "whatsapp.accessToken": seal("panel-token"), "whatsapp.phoneNumberId": seal("222") })
    await run("merchant_new_order")
    expect([sent[0]?.name, sent[0]?.lang]).toEqual(["tpl_merchant_new_order", "ar"])
  })

  it("غير مفعّل (لا مفاتيح) ← وضع السجل بالنص الإنجليزي، بلا رجوع ولا شبكة", async () => {
    expect(whatsappEnabled()).toBe(false)
    await run()
    expect(sent).toHaveLength(0)
    expect(logs.some((l) => l.includes("[whatsapp:dev] order_placed (en)"))).toBe(true)
    expect(fellBack()).toBe(false)
  })
})
