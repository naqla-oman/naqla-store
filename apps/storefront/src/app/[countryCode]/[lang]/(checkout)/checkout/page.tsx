import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { releasePaymentLock } from "@lib/data/checkout"
import { listCartPaymentMethods } from "@lib/data/payment"
import { retrieveCustomer } from "@lib/data/customer"
import { CART_FIELDS } from "@lib/util/cart-fields"
import CheckoutFlow from "@modules/checkout/templates/checkout-flow"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getShippingConfig } from "@lib/data/shipping-threshold"
import { langPrefix } from "@/i18n/config"

export const metadata: Metadata = {
  title: "إتمام الطلب",
  robots: { index: false },
}

type Props = {
  params: Promise<{ countryCode: string; lang: string }>
  searchParams: Promise<{ step?: string; error?: string }>
}

export default async function Checkout(props: Props) {
  const { countryCode, lang } = await props.params
  const { step, error } = await props.searchParams
  // H2: عادت من ثواني بالإلغاء → فكّ قفل السلة لتتمكن من تعديلها أو اختيار طريقة أخرى
  if (error === "thawani_cancelled") await releasePaymentLock()
  const cart = await retrieveCart(undefined, CART_FIELDS)

  if (!cart?.items?.length) redirect(`/${countryCode}${langPrefix(lang)}/cart`)

  const hasAddress = !!cart.shipping_address?.province && !!cart.shipping_address?.phone
  const current = step === "payment" && hasAddress ? "payment" : "address"

  const [{ shipping_options }, providers, customer, shipCfg] = await Promise.all([
    hasAddress ? listCartOptions() : Promise.resolve({ shipping_options: [] }),
    cart.region_id ? listCartPaymentMethods(cart.region_id) : Promise.resolve([]),
    retrieveCustomer(),
    getShippingConfig(),
  ])

  return (
    <CheckoutFlow
      cart={cart}
      shippingOptions={shipping_options ?? []}
      providers={(providers ?? []).map((p) => p.id)}
      countryCode={countryCode}
      step={current}
      error={error}
      customer={customer}
      enabledGovernorates={shipCfg.governorates}
    />
  )
}
