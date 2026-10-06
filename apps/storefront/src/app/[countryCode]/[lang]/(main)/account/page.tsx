import { retrieveCustomer } from "@lib/data/customer"
import { getLoyalty, listMyOrders } from "@lib/data/account"
import PhoneLogin from "@modules/account/phone-login"
import AccountDashboard from "@modules/account/dashboard"
import { Metadata } from "next"
import { getT } from "@/i18n/t"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account")
  return { title: t("sc0f526"), robots: { index: false } }
}

export default async function AccountPage() {
  const customer = await retrieveCustomer()
  if (!customer) return <PhoneLogin />
  const [loyalty, orders] = await Promise.all([
    getLoyalty(),
    listMyOrders(20),
  ])
  return <AccountDashboard customer={customer} loyalty={loyalty} orders={orders ?? []} />
}
