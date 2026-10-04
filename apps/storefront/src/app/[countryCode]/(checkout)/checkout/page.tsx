import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { listCartPaymentMethods } from "@lib/data/payment"
import { CART_FIELDS } from "@lib/util/cart-fields"
import CheckoutFlow from "@modules/checkout/templates/checkout-flow"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "إتمام الطلب",
  robots: { index: false },
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string; error?: string }>
}

export default async function Checkout(props: Props) {
  const { countryCode } = await props.params
  const { step, error } = await props.searchParams
  const cart = await retrieveCart(undefined, CART_FIELDS)

  if (!cart?.items?.length) redirect(`/${countryCode}/cart`)

  const hasAddress = !!cart.shipping_address?.province && !!cart.shipping_address?.phone
  const current = step === "payment" && hasAddress ? "payment" : "address"

  const [{ shipping_options }, providers] = await Promise.all([
    hasAddress ? listCartOptions() : Promise.resolve({ shipping_options: [] }),
    cart.region_id ? listCartPaymentMethods(cart.region_id) : Promise.resolve([]),
  ])

  return (
    <CheckoutFlow
      cart={cart}
      shippingOptions={shipping_options ?? []}
      providers={(providers ?? []).map((p) => p.id)}
      countryCode={countryCode}
      step={current}
      error={error}
    />
  )
}
