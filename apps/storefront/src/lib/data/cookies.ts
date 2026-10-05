import "server-only"
import { cookies as nextCookies } from "next/headers"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies()
    const cacheId = cookies.get("_medusa_cache_id")?.value

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch (error) {
    return ""
  }
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {}
  }

  // H1: وسم عام (global:<tag>) مع كل طلب — يُبطَل من الخادم عند تعديل المنتج/السعر/المخزون.
  // (سابقاً بلا كوكي cache_id لم يكن للطلب أي وسم فيبقى force-cache قديماً إلى الأبد)
  const cacheTag = await getCacheTag(tag)
  return { tags: cacheTag ? [cacheTag, `global:${tag}`] : [`global:${tag}`] }
}

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    // C6: lax لا strict — العودة من بوابة الدفع (ثواني) تنقّل من موقع آخر، وstrict يمنع إرسال الكوكي فيضيع الطلب بعد الخصم.
    // lax يُرسل في التنقل العلوي GET فقط ويبقى محمياً من طلبات POST عبر المواقع.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    // C6: lax لا strict — العودة من بوابة الدفع (ثواني) تنقّل من موقع آخر، وstrict يمنع إرسال الكوكي فيضيع الطلب بعد الخصم.
    // lax يُرسل في التنقل العلوي GET فقط ويبقى محمياً من طلبات POST عبر المواقع.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", "", {
    maxAge: -1,
  })
}
