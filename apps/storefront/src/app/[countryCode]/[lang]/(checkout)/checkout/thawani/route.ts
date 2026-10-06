import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheTag, getCartId, removeCartId } from "@lib/data/cookies"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { langPrefix } from "@/i18n/config"

/**
 * العودة من صفحة ثواني بعد الدفع.
 * completeCart يستدعي authorizePayment في مزوّد ثواني، الذي يتحقق من API ثواني
 * أن الجلسة «paid» فعلاً قبل إنشاء الطلب — فلا يكفي فتح هذا الرابط يدوياً.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ countryCode: string; lang: string }> }) {
  const { countryCode, lang } = await params
  const cartId = req.nextUrl.searchParams.get("cart_id")
  const back = (q: string) => NextResponse.redirect(new URL(`/${countryCode}${langPrefix(lang)}/checkout?step=payment&${q}`, req.url))

  if (!cartId || cartId !== (await getCartId())) return back("error=thawani_session")

  try {
    const res = await sdk.store.cart.complete(cartId, {}, await getAuthHeaders())
    if (res.type !== "order") return back("error=thawani_unpaid")
    await removeCartId()
    revalidateTag(await getCacheTag("carts"))
    revalidateTag(await getCacheTag("orders"))
    return NextResponse.redirect(new URL(`/${countryCode}${langPrefix(lang)}/order/${res.order.id}/confirmed`, req.url))
  } catch {
    return back("error=thawani_unpaid")
  }
}
