import { retrieveConfirmedOrder } from "@lib/data/orders"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ via?: string }>
}

export const metadata: Metadata = {
  title: "تم استلام طلبك",
  robots: { index: false },
}

export default async function OrderConfirmedPage(props: Props) {
  const { id } = await props.params
  const { via } = await props.searchParams
  const data = await retrieveConfirmedOrder(id).catch(() => null)
  if (!data?.order) return notFound()
  return <OrderCompletedTemplate order={data.order} extras={data.extras} via={via} />
}
