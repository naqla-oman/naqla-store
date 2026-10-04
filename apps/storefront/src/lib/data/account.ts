"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheTag, setAuthToken } from "./cookies"
import { transferCart } from "./customer"
import { storeConfig } from "../../store.config"

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const PLACEHOLDER = "@phone.invalid"
const phoneRe = new RegExp(storeConfig.checkout.phone.pattern)
const full = (p: string) => `${storeConfig.checkout.phone.prefix}${p}`
const msg = (e: unknown, fallback: string) => {
  const m = String((e as any)?.message ?? "")
  // رسائل الخلفية عربية أصلاً؛ رسائل النظام الإنجليزية تُستبدل برسالة عامة
  return /[\u0600-\u06FF]/.test(m) ? m : fallback
}
const jwtPayload = (token: string) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { actor_id?: string }
  } catch {
    return {}
  }
}
const refreshCustomer = async () => {
  revalidateTag(await getCacheTag("customers"))
  revalidateTag(await getCacheTag("orders"))
}

/** ينسب طلبات الضيف بنفس الرقم ويستكمل النقاط ويضم المفضلة المحلية ويربط السلة */
async function afterLogin(localWishlist: string[]) {
  const headers = await getAuthHeaders()
  await sdk.client.fetch("/store/customers/me/claim-orders", { method: "POST", headers }).catch(() => null)
  if (localWishlist.length) await mergeWishlist(localWishlist)
  await transferCart().catch(() => null)
  await refreshCustomer()
}

/** الخطوة 1: إرسال رمز واتساب */
export async function requestOtp(phone: string): Promise<Result> {
  if (!phoneRe.test(phone)) return { ok: false, error: "رقم عُماني من 8 أرقام يبدأ بـ 9 أو 7" }
  try {
    await sdk.client.fetch("/auth/customer/phone-auth", { method: "POST", body: { phone: full(phone) } })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, "تعذّر إرسال الرمز، حاولي بعد قليل") }
  }
}

/** الخطوة 2: التحقق من الرمز. needsProfile=true يعني زبونة جديدة تحتاج اسمها */
export async function verifyOtp(phone: string, otp: string, localWishlist: string[] = []): Promise<Result<{ needsProfile: boolean }>> {
  try {
    const { token } = await sdk.client.fetch<{ token: string }>(
      `/auth/customer/phone-auth/callback?phone=${encodeURIComponent(full(phone))}&otp=${encodeURIComponent(otp)}`,
      { method: "POST" }
    )
    await setAuthToken(token)
    if (!jwtPayload(token).actor_id) return { ok: true, data: { needsProfile: true } }
    await afterLogin(localWishlist)
    return { ok: true, data: { needsProfile: false } }
  } catch (e) {
    return { ok: false, error: msg(e, "الرمز غير صحيح") }
  }
}

/** الخطوة 3 (أول مرة فقط): إنشاء الحساب بالاسم والبريد الاختياري */
export async function completeProfile(input: { firstName: string; lastName: string; email: string }, localWishlist: string[] = []): Promise<Result> {
  if (!input.firstName.trim()) return { ok: false, error: "أدخلي اسمك" }
  try {
    await sdk.client.fetch("/store/phone-account", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { first_name: input.firstName, last_name: input.lastName, email: input.email || undefined },
    })
    // رمز جديد يحمل معرّف الزبونة
    const { token } = await sdk.client.fetch<{ token: string }>("/auth/token/refresh", {
      method: "POST",
      headers: await getAuthHeaders(),
    })
    await setAuthToken(token)
    await afterLogin(localWishlist)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, "تعذّر إنشاء الحساب") }
  }
}

/* ===== طلبات الحساب ===== */

/** طلبات الزبونة بلا تخزين مؤقت: حالتها تتغيّر من لوحة التحكم (شحن/توصيل/إلغاء) خارج المتجر */
export async function listMyOrders(limit = 20) {
  return sdk.client
    .fetch<{ orders: import("@medusajs/types").HttpTypes.StoreOrder[] }>("/store/orders", {
      query: { limit, order: "-created_at", fields: "id,display_id,created_at,status,total,*items,*fulfillments" },
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    .then((r) => r.orders)
    .catch(() => [])
}

/* ===== الولاء ===== */

export type LoyaltyData = {
  available: number
  pending: number
  confirmed: number
  tier: { key: string; name: string; min: number }
  next_tier: { key: string; name: string; min: number } | null
  rules: { pointsPerUnit: number; redeemPoints: number; redeemValue: number; tiers: { key: string; name: string; min: number }[] }
  entries: { id: string; kind: "earn" | "redeem"; status: "pending" | "available" | "canceled"; points: number; order_display_id: number | null; code: string | null; created_at: string }[]
}

export async function getLoyalty(): Promise<LoyaltyData | null> {
  return sdk.client
    .fetch<LoyaltyData>("/store/customers/me/loyalty", { headers: await getAuthHeaders(), cache: "no-store" })
    .catch(() => null)
}

export async function redeemPoints(): Promise<Result<{ code: string }>> {
  try {
    const r = await sdk.client.fetch<{ code: string }>("/store/customers/me/loyalty/redeem", {
      method: "POST",
      headers: await getAuthHeaders(),
    })
    revalidateTag(await getCacheTag("customers"))
    return { ok: true, data: r }
  } catch (e) {
    return { ok: false, error: msg(e, "تعذّر الاستبدال") }
  }
}

/* ===== الملف الشخصي ===== */

export const isPlaceholderEmail = async (email?: string | null) => !!email?.endsWith(PLACEHOLDER)

export async function updateEmail(email: string, onlyIfPlaceholder = false): Promise<Result> {
  try {
    await sdk.client.fetch("/store/customers/me/email", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { email, only_if_placeholder: onlyIfPlaceholder },
    })
    await refreshCustomer()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, "تعذّر حفظ البريد") }
  }
}

export async function updateName(firstName: string, lastName: string): Promise<Result> {
  if (!firstName.trim()) return { ok: false, error: "أدخلي اسمك" }
  try {
    await sdk.store.customer.update({ first_name: firstName.trim(), last_name: lastName.trim() }, {}, await getAuthHeaders())
    await refreshCustomer()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, "تعذّر الحفظ") }
  }
}

/* ===== المفضلة (metadata.wishlist في حساب الزبونة) ===== */

async function currentWishlist(): Promise<string[]> {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return []
  const { customer } = await sdk.store.customer.retrieve({ fields: "metadata" }, headers).catch(() => ({ customer: null as any }))
  const list = (customer?.metadata as any)?.wishlist
  return Array.isArray(list) ? list.filter((x) => typeof x === "string") : []
}

async function saveWishlist(ids: string[]) {
  await sdk.store.customer.update({ metadata: { wishlist: ids.slice(0, 200) } }, {}, await getAuthHeaders())
  revalidateTag(await getCacheTag("customers"))
}

export async function getWishlist(): Promise<string[]> {
  return currentWishlist().catch(() => [])
}

export async function mergeWishlist(local: string[]) {
  const mine = await currentWishlist()
  const merged = Array.from(new Set([...mine, ...local]))
  if (merged.length !== mine.length) await saveWishlist(merged)
  return merged
}

export async function toggleWishlist(productId: string): Promise<Result<{ ids: string[] }>> {
  try {
    const mine = await currentWishlist()
    const ids = mine.includes(productId) ? mine.filter((x) => x !== productId) : [productId, ...mine]
    await saveWishlist(ids)
    return { ok: true, data: { ids } }
  } catch (e) {
    return { ok: false, error: msg(e, "تعذّر تحديث المفضلة") }
  }
}

/* ===== التتبّع ===== */

export type TrackedOrder = {
  id: string
  display_id: number
  status: string
  stage: number
  shipping_code: string | null
  shipping_name: string | null
  province: string | null
  city: string | null
  total: number
  times: { placed: string; packed: string | null; shipped: string | null; delivered: string | null }
  items: { id: string; title: string; variant: string | null; quantity: number; unit_price: number; thumbnail: string | null }[]
}

export async function trackOrder(number: string, phone: string): Promise<Result<TrackedOrder>> {
  if (!number.trim()) return { ok: false, error: "أدخلي رقم الطلب" }
  if (!phoneRe.test(phone)) return { ok: false, error: "رقم عُماني من 8 أرقام يبدأ بـ 9 أو 7" }
  try {
    const { order } = await sdk.client.fetch<{ order: TrackedOrder }>("/store/track", {
      method: "POST",
      body: { number, phone },
      cache: "no-store",
    })
    return { ok: true, data: order }
  } catch (e) {
    return { ok: false, error: msg(e, "لم نجد طلباً بهذا الرقم وهذا الهاتف") }
  }
}

/* ===== منتجات المفضلة (بيانات مختصرة للبطاقات) ===== */

export type WishProduct = { id: string; handle: string; title: string; thumbnail: string | null; price: number; old: number | null; category: string | null }

export async function wishlistProducts(ids: string[], countryCode: string): Promise<WishProduct[]> {
  if (!ids.length) return []
  const { listProducts } = await import("./products")
  const { response } = await listProducts({
    countryCode,
    queryParams: { id: ids.slice(0, 100), limit: 100, fields: "*variants.calculated_price,+metadata,*categories" },
  })
  const byId = new Map(response.products.map((p) => [p.id, p]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p: any) => {
      const prices = (p.variants ?? []).map((v: any) => v.calculated_price?.calculated_amount).filter((x: any) => x != null)
      const price = prices.length ? Math.min(...prices) : 0
      const old = Number(p.metadata?.compare_at_price) || null
      return { id: p.id, handle: p.handle, title: p.title, thumbnail: p.thumbnail, price, old: old && old > price ? old : null, category: p.categories?.[0]?.name ?? null }
    })
}
