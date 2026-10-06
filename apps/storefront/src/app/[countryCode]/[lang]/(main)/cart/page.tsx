import { retrieveCart } from "@lib/data/cart"
import { CART_FIELDS } from "@lib/util/cart-fields"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { getFreeShippingOver } from "@lib/data/shipping-threshold"

export const metadata: Metadata = {
  title: "سلة التسوق",
  robots: { index: false },
}

export default async function Cart() {
  const cart = await retrieveCart(undefined, CART_FIELDS).catch(() => null)
  return <CartTemplate cart={cart} freeOver={await getFreeShippingOver()} />
}
