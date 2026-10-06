import { Metadata } from "next"

import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import { WishlistProvider } from "@lib/context/wishlist"
import { getTrackingConfig } from "@lib/data/tracking"
import Tracking from "@modules/common/components/tracking"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()

  const tracking = await getTrackingConfig()
  const wish = ((customer?.metadata as any)?.wishlist ?? []) as string[]

  return (
    <WishlistProvider initial={wish} loggedIn={!!customer}>
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {props.children}
      <Footer />
      <Tracking config={tracking} />
    </WishlistProvider>
  )
}
