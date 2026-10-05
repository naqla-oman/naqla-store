import TrackOrder from "@modules/account/track-order"
import { retrieveCustomer } from "@lib/data/customer"
import { Metadata } from "next"

export const metadata: Metadata = { title: "تتبّع طلبك", robots: { index: false } }

export default async function TrackPage(props: { searchParams: Promise<{ no?: string; phone?: string }> }) {
  const { no, phone } = await props.searchParams
  const customer = await retrieveCustomer().catch(() => null)
  return <TrackOrder initialNo={no ?? ""} initialPhone={(phone ?? "").replace(/\D/g, "").slice(-8)} signedIn={!!customer} />
}
