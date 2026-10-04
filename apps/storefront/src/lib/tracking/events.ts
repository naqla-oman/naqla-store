"use client"

/**
 * طبقة أحداث موحّدة: حدث واحد ← GA4 + Meta Pixel + Snap Pixel + TikTok Pixel بنفس event_id.
 * الخادم يرسل الشراء بنفس المعرّف (purchase_<order_id>) فتُزال الازدواجية في كل منصة.
 * كل منصة تُستدعى فقط إن حُمّلت (معرّفها موجود + الموافقة)، والنداءات قبل التحميل تُصفّ في طوابير المنصات.
 */

export type TrackEvent =
  | "view_item"
  | "view_item_list"
  | "search"
  | "add_to_wishlist"
  | "add_to_cart"
  | "begin_checkout"
  | "add_shipping_info"
  | "add_payment_info"
  | "purchase"
  | "sign_up"

export type TrackItem = { id: string; name: string; price?: number; quantity?: number; variant?: string; category?: string }
export type TrackParams = {
  event_id?: string
  value?: number
  currency?: string
  items?: TrackItem[]
  search_term?: string
  list_name?: string
  transaction_id?: string
  shipping_tier?: string
  payment_type?: string
  method?: string
}

/** null = لا يُرسل لهذه المنصة. Meta: [اسم، مخصص؟] */
const MAP: Record<TrackEvent, { meta: [string, boolean] | null; snap: string | null; tiktok: string | null }> = {
  view_item: { meta: ["ViewContent", false], snap: "VIEW_CONTENT", tiktok: "ViewContent" },
  view_item_list: { meta: ["ViewItemList", true], snap: null, tiktok: null },
  search: { meta: ["Search", false], snap: "SEARCH", tiktok: "Search" },
  add_to_wishlist: { meta: ["AddToWishlist", false], snap: "ADD_TO_WISHLIST", tiktok: "AddToWishlist" },
  add_to_cart: { meta: ["AddToCart", false], snap: "ADD_CART", tiktok: "AddToCart" },
  begin_checkout: { meta: ["InitiateCheckout", false], snap: "START_CHECKOUT", tiktok: "InitiateCheckout" },
  add_shipping_info: { meta: ["AddShippingInfo", true], snap: null, tiktok: null },
  add_payment_info: { meta: ["AddPaymentInfo", false], snap: "ADD_BILLING", tiktok: "AddPaymentInfo" },
  purchase: { meta: ["Purchase", false], snap: "PURCHASE", tiktok: "CompletePayment" },
  sign_up: { meta: ["CompleteRegistration", false], snap: "SIGN_UP", tiktok: "CompleteRegistration" },
}

type W = Window & {
  gtag?: (...a: unknown[]) => void
  fbq?: (...a: unknown[]) => void
  snaptr?: (...a: unknown[]) => void
  ttq?: { track: (...a: unknown[]) => void }
  __trk?: { debug?: boolean; ready?: boolean; pending?: [TrackEvent, TrackParams][]; log: { event: string; event_id: string; to: string[] }[] }
}

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export function track(name: TrackEvent, p: TrackParams = {}) {
  if (typeof window === "undefined") return
  const w = window as W
  w.__trk = w.__trk ?? { log: [] }
  // قبل جاهزية البكسلات (أول تحميل للصفحة): يُصفّ الحدث بمعرّفه ويُرسل عند الجاهزية
  if (!w.__trk.ready) {
    ;(w.__trk.pending = w.__trk.pending ?? []).push([name, { ...p, event_id: p.event_id ?? `${name}_${uid()}` }])
    return
  }
  const event_id = p.event_id ?? `${name}_${uid()}`
  const currency = (p.currency ?? "OMR").toUpperCase()
  const items = p.items ?? []
  const ids = items.map((i) => i.id)
  const to: string[] = []

  // GA4 (gtag مع Consent Mode — يعمل بحسب الموافقة)
  if (w.gtag) {
    w.gtag("event", name, {
      event_id,
      currency,
      value: p.value,
      transaction_id: p.transaction_id,
      search_term: p.search_term,
      item_list_name: p.list_name,
      shipping_tier: p.shipping_tier,
      payment_type: p.payment_type,
      method: p.method,
      items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1, item_variant: i.variant, item_category: i.category })),
    })
    to.push("ga4")
  }
  const m = MAP[name]
  const common = { value: p.value, currency, content_ids: ids, content_type: "product", num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0) || undefined }
  if (w.fbq && m.meta) {
    const data = { ...common, search_string: p.search_term, contents: items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price })) }
    w.fbq(m.meta[1] ? "trackCustom" : "track", m.meta[0], data, { eventID: event_id })
    to.push("meta")
  }
  if (w.snaptr && m.snap) {
    w.snaptr("track", m.snap, { price: p.value, currency, item_ids: ids, number_items: common.num_items, search_string: p.search_term, transaction_id: p.transaction_id, client_dedup_id: event_id })
    to.push("snap")
  }
  if (w.ttq && m.tiktok) {
    w.ttq.track(m.tiktok, { value: p.value, currency, content_type: "product", contents: items.map((i) => ({ content_id: i.id, content_name: i.name, quantity: i.quantity ?? 1, price: i.price })), query: p.search_term }, { event_id })
    to.push("tiktok")
  }
  // سجل للتحقق في الاختبار (window.__trk.log)
  w.__trk.log.push({ event: name, event_id, to })
  if (w.__trk.debug) console.info("[track]", name, event_id, to)
}

/** عنصر تتبّع من منتج Medusa ومتغيّره */
export const itemOf = (p: { id?: string; title?: string; categories?: { name?: string }[] | null }, v?: { id?: string; title?: string | null } | null, price?: number, quantity = 1): TrackItem => ({
  id: v?.id ?? p.id ?? "",
  name: p.title ?? "",
  price,
  quantity,
  variant: v?.title ?? undefined,
  category: p.categories?.[0]?.name ?? undefined,
})

/** يُستدعى من مكوّن التتبع بعد تهيئة المنصات: يعلن الجاهزية ويرسل ما صُفّ قبلها */
export function flushTracking() {
  if (typeof window === "undefined") return
  const w = window as W
  w.__trk = w.__trk ?? { log: [] }
  w.__trk.ready = true
  const queue = w.__trk.pending ?? []
  w.__trk.pending = []
  for (const [name, params] of queue) track(name, params)
}
