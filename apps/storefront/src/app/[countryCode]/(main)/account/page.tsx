import { retrieveCustomer } from "@lib/data/customer"
import { getLoyalty } from "@lib/data/account"
import { listOrders } from "@lib/data/orders"
import PhoneLogin from "@modules/account/phone-login"
import AccountDashboard from "@modules/account/dashboard"
import { Metadata } from "next"

export const metadata: Metadata = { title: "حسابي", robots: { index: false } }

export default async function AccountPage() {
  const customer = await retrieveCustomer()
  if (!customer) return <PhoneLogin />
  const [loyalty, orders] = await Promise.all([
    getLoyalty(),
    listOrders(20, 0, { fields: "id,display_id,created_at,status,total,*items,*fulfillments" }).catch(() => []),
  ])
  return <AccountDashboard customer={customer} loyalty={loyalty} orders={orders ?? []} />
}
