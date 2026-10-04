import { retrieveCustomer } from "@lib/data/customer"
import { getLoyalty, listMyOrders } from "@lib/data/account"
import PhoneLogin from "@modules/account/phone-login"
import AccountDashboard from "@modules/account/dashboard"
import { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "حسابي", robots: { index: false } }

export default async function AccountPage() {
  const customer = await retrieveCustomer()
  if (!customer) return <PhoneLogin />
  const [loyalty, orders] = await Promise.all([
    getLoyalty(),
    listMyOrders(20),
  ])
  return <AccountDashboard customer={customer} loyalty={loyalty} orders={orders ?? []} />
}
