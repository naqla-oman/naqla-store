import WishlistView from "@modules/account/wishlist-view"
import { Metadata } from "next"
import { getT, useT } from "@/i18n/t"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account")
  return { title: t("s501839"), robots: { index: false } }
}

export default function WishlistPage() {
  return <WishlistView />
}
