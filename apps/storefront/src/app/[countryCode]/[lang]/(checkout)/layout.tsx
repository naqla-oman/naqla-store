import Nav from "@modules/layout/templates/nav"
import Tracking from "@modules/common/components/tracking"
import { getTrackingConfig } from "@lib/data/tracking"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "@/store.config"

/** تخطيط الدفع: الهيدر الكامل بدون الفوتر وشريط التبويبات (الشريط المثبّت يحل محله) */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const tracking = await getTrackingConfig()
  return (
    <>
      <Nav />
      <div data-testid="checkout-container">{children}</div>
      <Tracking config={tracking} />
      <footer className="wrap" style={{ padding: "20px 16px 28px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
        <Icon name="lock" size={12} /> دفع آمن ومشفّر · {storeConfig.name} · {storeConfig.contact.address}
      </footer>
    </>
  )
}
