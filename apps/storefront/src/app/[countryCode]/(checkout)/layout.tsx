import Nav from "@modules/layout/templates/nav"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "../../../store.config"

/** تخطيط الدفع: الهيدر الكامل بدون الفوتر وشريط التبويبات (الشريط المثبّت يحل محله) */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div data-testid="checkout-container">{children}</div>
      <footer className="wrap" style={{ padding: "20px 16px 28px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
        <Icon name="lock" size={12} /> دفع آمن ومشفّر · {storeConfig.name} · {storeConfig.contact.address}
      </footer>
    </>
  )
}
