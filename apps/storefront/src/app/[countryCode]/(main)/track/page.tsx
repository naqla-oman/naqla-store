import TrackOrder from "@modules/account/track-order"
import { Metadata } from "next"

export const metadata: Metadata = { title: "تتبّع طلبك", robots: { index: false } }

export default async function TrackPage(props: { searchParams: Promise<{ no?: string; phone?: string }> }) {
  const { no, phone } = await props.searchParams
  return <TrackOrder initialNo={no ?? ""} initialPhone={(phone ?? "").replace(/\D/g, "").slice(-8)} />
}
