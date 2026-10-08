import crypto from "crypto"
import { adminErrorMessage } from "./admin-i18n"

/**
 * إرسال الأحداث من الخادم: Meta CAPI، Snap CAPI (v3)، TikTok Events API (v1.3)، GA4 Measurement Protocol.
 * نفس event_id المستخدم في المتصفح ← المنصات تزيل التكرار.
 * الهاتف والبريد يُطبَّعان ثم يُجزَّآن SHA-256 قبل الإرسال (لا تغادر بيانات شخصية صريحة).
 */

export type ServerEventName = "purchase" | "order_delivered" | "test"

export type ServerEvent = {
  name: ServerEventName
  event_id: string
  time?: number // بالثواني
  value?: number
  currency?: string
  order_id?: string
  url?: string
  contents?: { id: string; quantity: number; price: number }[]
  user?: {
    email?: string | null
    phone?: string | null
    external_id?: string | null
    ip?: string | null
    ua?: string | null
    fbp?: string | null
    fbc?: string | null
    ttclid?: string | null
    sccid?: string | null
    ga_client_id?: string | null
  }
}

export type TrackingCreds = {
  ga4_measurement_id?: string | null
  ga4_api_secret?: string | null
  meta_pixel_id?: string | null
  meta_access_token?: string | null
  meta_test_event_code?: string | null
  meta_test_event_code_at?: Date | string | null
  tiktok_test_event_code_at?: Date | string | null
  snap_pixel_id?: string | null
  snap_access_token?: string | null
  snap_test_mode?: boolean | null
  tiktok_pixel_id?: string | null
  tiktok_access_token?: string | null
  tiktok_test_event_code?: string | null
}

export type Platform = "meta" | "snap" | "tiktok" | "ga4"
export type SendOpts = { debug?: boolean; test?: boolean }

/** M6: رمز الاختبار يُطبَّق على الأحداث الفعلية 24 ساعة من حفظه فقط (نسيانه كان يحوّل كل المشتريات لنافذة الاختبار) */
export const TEST_CODE_TTL_MS = 24 * 3600_000
export function activeTestCode(code?: string | null, at?: Date | string | null, opts: SendOpts = {}) {
  if (!code) return undefined
  if (opts.test) return code
  return at && Date.now() - new Date(at).getTime() < TEST_CODE_TTL_MS ? code : undefined
}
export type SendResult = { platform: Platform; ok: boolean; status: number; skipped?: string; response?: string }

// ---------- التجزئة ----------
const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex")
export const hashEmail = (e?: string | null) => {
  const v = (e ?? "").trim().toLowerCase()
  // البريد المحجوز (phone.invalid) ليس بريداً حقيقياً — لا يُرسل
  return v && v.includes("@") && !v.endsWith("@phone.invalid") ? sha(v) : undefined
}
/** E.164 بلا «+»: 968XXXXXXXX (المنصات تطلب الأرقام فقط مع رمز الدولة) */
export const normPhone = (p?: string | null, country = "968") => {
  const d = (p ?? "").replace(/\D/g, "")
  if (!d) return undefined
  return d.length === 8 ? `${country}${d}` : d
}
export const hashPhone = (p?: string | null) => {
  const n = normPhone(p)
  return n ? sha(n) : undefined
}

// ---------- أسماء الأحداث لكل منصة ----------
const NAMES: Record<ServerEventName, Record<Platform, string>> = {
  purchase: { meta: "Purchase", snap: "PURCHASE", tiktok: "CompletePayment", ga4: "purchase" },
  order_delivered: { meta: "OrderDelivered", snap: "CUSTOM_EVENT_1", tiktok: "OrderDelivered", ga4: "order_delivered" },
  test: { meta: "PageView", snap: "PAGE_VIEW", tiktok: "ViewContent", ga4: "page_view" },
}

const short = async (res: Response) => (await res.text().catch(() => "")).slice(0, 600)

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
}

// ---------- Meta Conversions API ----------
export async function sendMeta(c: TrackingCreds, e: ServerEvent, opts: SendOpts = {}): Promise<SendResult> {
  const testCode = activeTestCode(c.meta_test_event_code, c.meta_test_event_code_at, opts)
  if (!c.meta_pixel_id || !c.meta_access_token) return { platform: "meta", ok: false, status: 0, skipped: adminErrorMessage("tracking_no_pixel") }
  const u = e.user ?? {}
  const body = {
    data: [
      {
        event_name: NAMES[e.name].meta,
        event_time: e.time ?? Math.floor(Date.now() / 1000),
        event_id: e.event_id,
        action_source: "website",
        event_source_url: e.url,
        user_data: {
          em: hashEmail(u.email) ? [hashEmail(u.email)] : undefined,
          ph: hashPhone(u.phone) ? [hashPhone(u.phone)] : undefined,
          external_id: u.external_id ? [sha(u.external_id)] : undefined,
          fbp: u.fbp || undefined,
          fbc: u.fbc || undefined,
          client_ip_address: u.ip || undefined,
          client_user_agent: u.ua || undefined,
        },
        custom_data: e.value != null
          ? {
              currency: (e.currency ?? "omr").toUpperCase(),
              value: e.value,
              order_id: e.order_id,
              content_type: "product",
              contents: e.contents?.map((x) => ({ id: x.id, quantity: x.quantity, item_price: x.price })),
            }
          : undefined,
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  }
  const res = await post(`https://graph.facebook.com/v21.0/${c.meta_pixel_id}/events?access_token=${encodeURIComponent(c.meta_access_token)}`, body)
  return { platform: "meta", ok: res.ok, status: res.status, response: await short(res) }
}

// ---------- Snap Conversions API v3 ----------
export async function sendSnap(c: TrackingCreds, e: ServerEvent, _opts: SendOpts = {}): Promise<SendResult> {
  if (!c.snap_pixel_id || !c.snap_access_token) return { platform: "snap", ok: false, status: 0, skipped: adminErrorMessage("tracking_no_pixel") }
  const u = e.user ?? {}
  const body = {
    data: [
      {
        event_name: NAMES[e.name].snap,
        event_time: (e.time ?? Math.floor(Date.now() / 1000)) * 1000,
        event_id: e.event_id,
        action_source: "WEB",
        event_source_url: e.url,
        user_data: {
          em: hashEmail(u.email) ? [hashEmail(u.email)] : undefined,
          ph: hashPhone(u.phone) ? [hashPhone(u.phone)] : undefined,
          sc_click_id: u.sccid || undefined,
          client_ip_address: u.ip || undefined,
          client_user_agent: u.ua || undefined,
        },
        custom_data: e.value != null
          ? { currency: (e.currency ?? "omr").toUpperCase(), value: e.value, order_id: e.order_id, contents: e.contents?.map((x) => ({ id: x.id, quantity: x.quantity, item_price: x.price })) }
          : undefined,
      },
    ],
  }
  // وضع الاختبار: نقطة التحقق validate لا تُسجّل الحدث فعلياً
  const path = c.snap_test_mode ? "events/validate" : "events"
  const res = await post(`https://tr.snapchat.com/v3/${c.snap_pixel_id}/${path}?access_token=${encodeURIComponent(c.snap_access_token)}`, body)
  return { platform: "snap", ok: res.ok, status: res.status, response: await short(res) }
}

// ---------- TikTok Events API v1.3 ----------
export async function sendTikTok(c: TrackingCreds, e: ServerEvent, opts: SendOpts = {}): Promise<SendResult> {
  const testCode = activeTestCode(c.tiktok_test_event_code, c.tiktok_test_event_code_at, opts)
  if (!c.tiktok_pixel_id || !c.tiktok_access_token) return { platform: "tiktok", ok: false, status: 0, skipped: adminErrorMessage("tracking_no_pixel") }
  const u = e.user ?? {}
  const body = {
    event_source: "web",
    event_source_id: c.tiktok_pixel_id,
    ...(testCode ? { test_event_code: testCode } : {}),
    data: [
      {
        event: NAMES[e.name].tiktok,
        event_time: e.time ?? Math.floor(Date.now() / 1000),
        event_id: e.event_id,
        user: {
          email: hashEmail(u.email),
          phone: hashPhone(u.phone),
          external_id: u.external_id ? sha(u.external_id) : undefined,
          ttclid: u.ttclid || undefined,
          ip: u.ip || undefined,
          user_agent: u.ua || undefined,
        },
        page: e.url ? { url: e.url } : undefined,
        properties: e.value != null
          ? { currency: (e.currency ?? "omr").toUpperCase(), value: e.value, order_id: e.order_id, content_type: "product", contents: e.contents?.map((x) => ({ content_id: x.id, quantity: x.quantity, price: x.price })) }
          : undefined,
      },
    ],
  }
  const res = await post("https://business-api.tiktok.com/open_api/v1.3/event/track/", body, { "Access-Token": c.tiktok_access_token })
  const text = await short(res)
  // TikTok يعيد 200 مع code غير صفري عند الخطأ
  let ok = res.ok
  try { ok = ok && JSON.parse(text).code === 0 } catch { /* نص غير JSON */ }
  return { platform: "tiktok", ok, status: res.status, response: text }
}

// ---------- GA4 Measurement Protocol ----------
export async function sendGa4(c: TrackingCreds, e: ServerEvent, opts: SendOpts = {}): Promise<SendResult> {
  if (!c.ga4_measurement_id || !c.ga4_api_secret) return { platform: "ga4", ok: false, status: 0, skipped: adminErrorMessage("tracking_no_ga4") }
  const u = e.user ?? {}
  const body = {
    // client_id من كوكي _ga في المتصفح إن وُجد، وإلا معرّف ثابت من الطلب
    client_id: u.ga_client_id || `${Math.abs(hashCode(e.order_id ?? e.event_id))}.${Math.floor(Date.now() / 1000)}`,
    user_data: {
      sha256_email_address: hashEmail(u.email) ? [hashEmail(u.email)] : undefined,
      sha256_phone_number: hashPhone(u.phone) ? [sha(`+${normPhone(u.phone)}`)] : undefined,
    },
    events: [
      {
        name: NAMES[e.name].ga4,
        params: {
          event_id: e.event_id,
          transaction_id: e.order_id,
          value: e.value,
          currency: (e.currency ?? "omr").toUpperCase(),
          items: e.contents?.map((x) => ({ item_id: x.id, quantity: x.quantity, price: x.price })),
          engagement_time_msec: 1,
        },
      },
    ],
  }
  // debug: نقطة التحقق تعيد رسائل التحقق بدل التسجيل الصامت
  const base = opts.debug ? "https://www.google-analytics.com/debug/mp/collect" : "https://www.google-analytics.com/mp/collect"
  const res = await post(`${base}?measurement_id=${encodeURIComponent(c.ga4_measurement_id)}&api_secret=${encodeURIComponent(c.ga4_api_secret)}`, body)
  return { platform: "ga4", ok: res.ok, status: res.status, response: await short(res) }
}

const hashCode = (s: string) => [...s].reduce((h, ch) => (Math.imul(31, h) + ch.charCodeAt(0)) | 0, 0)

export const SENDERS: Record<Platform, (c: TrackingCreds, e: ServerEvent, o?: SendOpts) => Promise<SendResult>> = {
  meta: sendMeta,
  snap: sendSnap,
  tiktok: sendTikTok,
  ga4: sendGa4,
}

/** يرسل للمنصات المضبوطة فقط، ولا يرمي: كل نتيجة مستقلة */
export async function sendAll(c: TrackingCreds, e: ServerEvent): Promise<SendResult[]> {
  return Promise.all(
    (Object.keys(SENDERS) as Platform[]).map((p) =>
      SENDERS[p](c, e).catch((err) => ({ platform: p, ok: false, status: 0, response: String(err?.message ?? err) }))
    )
  )
}
