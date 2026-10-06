import { retrieveConfirmedOrder } from "@lib/data/orders"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getT } from "@/i18n/t"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ via?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("order")
  return {
  title: t("s9996b4"),
  robots: { index: false },
}
}

export default async function OrderConfirmedPage(props: Props) {
  const { id } = await props.params
  const { via } = await props.searchParams
  const data = await retrieveConfirmedOrder(id).catch(() => null)
  if (!data?.order) return notFound()
  return <OrderCompletedTemplate order={data.order} extras={data.extras} via={via} />
}
