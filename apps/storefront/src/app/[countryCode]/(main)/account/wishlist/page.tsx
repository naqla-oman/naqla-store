import WishlistView from "@modules/account/wishlist-view"
import { Metadata } from "next"

export const metadata: Metadata = { title: "المفضلة", robots: { index: false } }

export default function WishlistPage() {
  return <WishlistView />
}
