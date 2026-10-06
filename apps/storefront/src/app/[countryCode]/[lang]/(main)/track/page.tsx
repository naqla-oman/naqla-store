import TrackOrder from "@modules/account/track-order"
import { retrieveCustomer } from "@lib/data/customer"
import { Metadata } from "next"
import { getT } from "@/i18n/t"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("tracking")
  return { title: t("s9241c5"), robots: { index: false } }
}

export default async function TrackPage(props: { searchParams: Promise<{ no?: string; phone?: string }> }) {
  const { no, phone } = await props.searchParams
  const customer = await retrieveCustomer().catch(() => null)
  return <TrackOrder initialNo={no ?? ""} initialPhone={(phone ?? "").replace(/\D/g, "").slice(-8)} signedIn={!!customer} />
}
