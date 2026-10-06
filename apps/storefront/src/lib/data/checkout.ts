"use server"

import { sdk } from "@lib/config"
import { getBaseURL } from "@lib/util/env"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheTag, getCartId, removeCartId } from "./cookies"
import { storeConfig } from "../../store.config"
import { orderAttribution } from "../tracking/attribution"
import { g } from "@lib/voice"
import { products as nProducts } from "@lib/util/plural"
import { getT } from "@/i18n/t"

/**
 * إجراءات خطوات الدفع. كل إجراء يعيد { ok, error } بدل رمي استثناء،
 * لتعرض الواجهة رسالة عربية واضحة في مكانها.
 */
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

export type DeliveryInput = {
  name: string
  phone: string // 8 أرقام بدون البادئة
  email: string // اختياري
  province: string // رمز المحافظة مثل om-ma
  city: string
  address: string
  note: string
  gift: boolean
  giftMessage: string
  /** منخفضة: استلام من المحل — لا عنوان مطلوب، ويُستخدم موقع المحل */
  pickup?: boolean
}

const { checkout } = storeConfig
const phoneRe = new RegExp(checkout.phone.pattern)
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const refresh = async () => {
  revalidateTag(await getCacheTag("carts"))
  revalidateTag(await getCacheTag("fulfillment"))
  revalidateTag(await getCacheTag("shippingOptions"))
}

const fail = (e: unknown, fallback: string): ActionResult<never> => {
  const msg = (e as any)?.message as string | undefined
  console.error("[checkout]", msg)
  return { ok: false, error: fallback }
}

const cartIdOrFail = async () => {
  const id = await getCartId()
  if (!id) throw new Error("no-cart")
  return id
}

/** الخطوة 2: حفظ بيانات التوصيل (يتحقق من الحقول على الخادم أيضاً) */
export async function saveDelivery(input: DeliveryInput): Promise<ActionResult> {
  const t = await getT("checkoutActions")
  const name = input.name.trim().replace(/\s+/g, " ")
  if (name.split(" ").length < 2) return { ok: false, error: t("sfe3242") }
  if (!phoneRe.test(input.phone)) return { ok: false, error: t("sc4fdec") }
  const pickup = !!input.pickup && storeConfig.seo.shipping.some((s) => s.code === "pickup")
  if (pickup) {
    const loc = storeConfig.seo.location
    input = { ...input, province: loc.province ?? input.province, city: loc.wilayat ?? loc.city, address: t("pickupFrom", { place: loc.name }) }
  }
  if (!checkout.governorates.some((g) => g.code === input.province)) return { ok: false, error: t("se494ea") }
  if (!input.city.trim()) return { ok: false, error: t("sb11c49") }
  const email = input.email.trim().toLowerCase()
  if (email && !emailRe.test(email)) return { ok: false, error: t("s445e75") }

  try {
    const id = await cartIdOrFail()
    const [first, ...rest] = name.split(" ")
    const address = {
      first_name: first,
      last_name: rest.join(" "),
      phone: `${checkout.phone.prefix}${input.phone}`,
      country_code: storeConfig.locale.split("-")[1].toLowerCase(),
      province: input.province,
      city: input.city.trim(),
      address_1: input.address.trim() || input.city.trim(),
    }
    const { cart } = await sdk.store.cart.retrieve(id, { fields: "metadata" }, await getAuthHeaders())
    await sdk.store.cart.update(
      id,
      {
        shipping_address: address,
        billing_address: address,
        ...(email ? { email } : {}),
        metadata: {
          ...(cart.metadata ?? {}),
          gift: input.gift,
          pickup,
          gift_message: input.gift ? input.giftMessage.trim().slice(0, 200) : "",
          courier_note: input.note.trim().slice(0, 200),
        },
      },
      {},
      await getAuthHeaders()
    )
    // زبونة مسجّلة ببريد محجوز (phone.invalid): يحل بريدها الحقيقي محله
    const auth = await getAuthHeaders()
    if (email && "authorization" in auth) {
      await sdk.client
        .fetch("/store/customers/me/email", { method: "POST", headers: auth, body: { email, only_if_placeholder: true } })
        .catch(() => null)
    }
    await refresh()
    return { ok: true }
  } catch (e) {
    return fail(e, t("s53de24"))
  }
}

/** اختيار طريقة التوصيل */
export async function chooseShipping(optionId: string): Promise<ActionResult> {
  const t = await getT("checkoutActions")
  try {
    const id = await cartIdOrFail()
    await sdk.store.cart.addShippingMethod(id, { option_id: optionId }, {}, await getAuthHeaders())
    await refresh()
    return { ok: true }
  } catch (e) {
    return fail(e, t("s3e0791"))
  }
}

/**
 * M7: إعادة اختيار طريقة التوصيل الحالية ليعيد Medusa حساب سعرها (حد المجاني يتغيّر بعد الخصم).
 * Medusa لا يعيد حساب سعر طريقة التوصيل عند تغيّر الأكواد.
 */
async function refreshShipping(cartId: string) {
  const headers = await getAuthHeaders()
  const { cart } = await sdk.store.cart.retrieve(cartId, { fields: "shipping_methods.shipping_option_id" }, headers)
  const optionId = cart.shipping_methods?.[0]?.shipping_option_id
  if (optionId) await sdk.store.cart.addShippingMethod(cartId, { option_id: optionId }, {}, headers).catch(() => null)
}

/** تطبيق كود خصم: نتحقق أن Medusa قبله فعلاً (يتجاهل الأكواد غير الصالحة بصمت) */
export async function applyCode(raw: string): Promise<ActionResult> {
  const t = await getT("checkoutActions")
  const code = raw.trim().toUpperCase()
  if (!code) return { ok: false, error: t("s16b77e") }
  try {
    const id = await cartIdOrFail()
    const { cart } = await sdk.store.cart.update(
      id,
      { promo_codes: [code] },
      { fields: "*promotions" },
      await getAuthHeaders()
    )
    await refreshShipping(id)
    await refresh()
    const applied = cart.promotions?.some((p) => p.code?.toUpperCase() === code)
    return applied ? { ok: true } : { ok: false, error: t("s39732d") }
  } catch (e) {
    return fail(e, t("s39732d"))
  }
}

export async function removeCode(code: string): Promise<ActionResult> {
  const t = await getT("checkoutActions")
  try {
    const id = await cartIdOrFail()
    await sdk.client.fetch(`/store/carts/${id}/promotions`, {
      method: "DELETE",
      body: { promo_codes: [code] },
      headers: await getAuthHeaders(),
    })
    await refreshShipping(id)
    await refresh()
    return { ok: true }
  } catch (e) {
    return fail(e, t("s071b4b"))
  }
}

export type PlaceResult = { orderId: string; displayId: number; redirectUrl?: string }

/**
 * تأكيد الطلب:
 * - الدفع عند الاستلام / واتساب: جلسة دفع ثم completeCart مباشرة
 * - ثواني: جلسة دفع تعيد رابط صفحة ثواني؛ الإتمام بعد العودة في /checkout/thawani
 */
export async function placeOrderWith(providerId: string, countryCode: string): Promise<ActionResult<PlaceResult>> {
  const t = await getT("checkoutActions")
  const pay = checkout.payments.find((p) => p.id === providerId)
  if (!pay) return { ok: false, error: t("sf18fa8") }

  try {
    const id = await cartIdOrFail()
    const headers = await getAuthHeaders()
    const { cart } = await sdk.store.cart.retrieve(
      id,
      { fields: "*items,*shipping_methods,+metadata,*region,+total" },
      headers
    )
    if (!cart.items?.length) return { ok: false, error: t("sdd1f5a") }
    if (!cart.shipping_methods?.length) return { ok: false, error: t("se87ef1") }

    // Store API لا يوسّع shipping_option داخل طرق التوصيل، فنقرأ نوعه من خيارات السلة
    const optionId = cart.shipping_methods[0].shipping_option_id
    // M7: سعر التوصيل بحسب السلة الآن (قد يتغيّر بعد كود أو تعديل) قبل الدفع
    if (optionId) await sdk.store.cart.addShippingMethod(id, { option_id: optionId }, {}, headers).catch(() => null)
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions({ cart_id: id }, headers)
    const shippingCode = (shipping_options.find((o) => o.id === optionId)?.type as any)?.code
    await sdk.store.cart.update(
      id,
      {
        metadata: {
          ...(cart.metadata ?? {}),
          payment_channel: pay.key,
          shipping_code: shippingCode ?? null,
          // مصدر الطلب (أول/آخر زيارة) + بيانات المطابقة حسب موافقة الزبون
          attribution: await orderAttribution(),
        },
      },
      {},
      headers
    )

    const base = `${getBaseURL()}/${countryCode}`
    const { payment_collection } = await sdk.store.payment.initiatePaymentSession(
      cart as HttpTypes.StoreCart,
      {
        provider_id: providerId,
        data:
          pay.key === "thawani"
            ? {
                cart_id: id,
                title: `${storeConfig.name} — ${nProducts(cart.items.length)}`,
                success_url: `${base}/checkout/thawani?cart_id=${id}`,
                cancel_url: `${base}/checkout?step=payment&error=thawani_cancelled`,
              }
            : {},
      },
      {},
      headers
    )

    if (pay.key === "thawani") {
      const session = payment_collection.payment_sessions?.find((s) => s.provider_id === providerId)
      const url = session?.data?.checkout_url as string | undefined
      await refresh()
      if (!url) return { ok: false, error: t("s9ca6db") }
      // H2: قفل السلة قبل التحويل — تعديلها أثناء الدفع كان يحذف الجلسة فيُخصم المبلغ بلا طلب
      const locked = await sdk.client
        .fetch(`/store/carts/${id}/payment-lock`, { method: "POST", headers, body: { session_id: session?.data?.session_id } })
        .then(() => true)
        .catch(() => false)
      if (!locked) return { ok: false, error: t("s786e20") }
      return { ok: true, data: { orderId: "", displayId: 0, redirectUrl: url } }
    }

    const res = await sdk.store.cart.complete(id, {}, headers)
    if (res.type !== "order") {
      return { ok: false, error: (res as any).error?.message ? t("sd7482e") : t("sae70b8") }
    }
    await removeCartId()
    await refresh()
    revalidateTag(await getCacheTag("orders"))
    return { ok: true, data: { orderId: res.order.id, displayId: res.order.display_id ?? 0 } }
  } catch (e) {
    const msg = String((e as any)?.message ?? "")
    if (/inventory|stock/i.test(msg)) return { ok: false, error: t("s6935ad") }
    return fail(e, t("s2d258f"))
  }
}

/** H2: فكّ قفل السلة عند العودة من ثواني بعد الإلغاء */
export async function releasePaymentLock() {
  const id = await getCartId()
  if (!id) return
  await sdk.client.fetch(`/store/carts/${id}/payment-lock`, { method: "DELETE", headers: await getAuthHeaders() }).catch(() => null)
}
