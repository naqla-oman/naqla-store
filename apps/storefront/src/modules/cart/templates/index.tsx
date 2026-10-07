import { HttpTypes } from "@medusajs/types"
import Signed from "@modules/common/components/signed"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import Steps from "@modules/checkout/components/steps"
import { formatAmount } from "@lib/util/money"
import CartLines from "./lines"
import { storeConfig } from "../../../store.config"
import { g } from "@lib/voice"
import { discountLines } from "@lib/util/discounts"
import { useCurrencyLabel, useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

/** صفحة السلة — الخطوة الأولى (مطابقة لسلة الديمو) */
export default function CartTemplate({ cart, freeOver: threshold }: { cart: HttpTypes.StoreCart | null; freeOver?: number | null }) {
  const sc = useStoreConfig()
  const t = useT("cart")
  const CUR = useCurrencyLabel()
  const items = cart?.items ?? []
  const count = items.reduce((s, i) => s + i.quantity, 0)

  if (!cart || !items.length) {
    return (
      <div className="wrap">
        <Steps current={0} />
        <div className="empty">
          <Icon name="bag" size={46} />
          <p>{t("s51f5b1")}</p>
          <LocalizedClientLink href="/store" className="btn">{t("s43552d")}</LocalizedClientLink>
        </div>
      </div>
    )
  }

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const discount = Math.max(0, (cart.discount_total ?? 0) - ((cart as any).shipping_discount_total ?? 0))
  // M19: من قاعدة Medusa عبر الصفحة (store.json احتياطي)
  const freeOver = threshold === undefined ? sc.freeShippingOver : threshold ?? 0
  const left = Math.max(0, freeOver - (subtotal - discount))

  return (
    <div className="wrap has-costicky">
      <Steps current={0} />
      <h1 className="pagehead">{t("sacf86f")} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>({count})</span></h1>
      <div className="cartpage">
        <div className="panelbox">
          <div className="shipbar">
            {left > 0 ? (
              <>{t("s4fdfdb")} <b>{formatAmount(left)} {CUR}</b> {t("s7ba5ef")}</>
            ) : (
              <><Icon name="check" size={14} /> {t("s2fc9ba")}</>
            )}
            <div className="bar"><i style={{ width: `${Math.min(100, ((subtotal - discount) / freeOver) * 100)}%` }} /></div>
          </div>
          <CartLines items={items} />
        </div>

        <aside className="sumcol">
          <div className="panelbox">
            <h3>{t("seeea12")}</h3>
            <div style={{ marginTop: 12 }}>
              <div className="trow"><span>{t("s7512af")}</span><span>{formatAmount(subtotal)} {CUR}</span></div>
              {/* منخفضة: سطر لكل عرض بمبلغه (الكود منفصل عن امتياز المستوى) */}
              {discount > 0 && discountLines(t, cart.items, cart.promotions as any).map((d) => (
                <div key={d.code} className="trow" data-testid="discount-line">
                  <span>{d.label}</span>
                  <span className="off"><Signed sign="−" value={formatAmount(d.amount)} /> {CUR}</span>
                </div>
              ))}
              <div className="trow"><span>{t("s30ecbc")}</span><span>{left > 0 ? t("byAddress") : t("s5abc46")}</span></div>
              <div className="trow final"><span>{t("s88fc73")}</span><Money amount={subtotal - discount} className="" /></div>
            </div>
            <LocalizedClientLink href="/checkout" className="btn block lg" data-testid="checkout-button">
              {t("se4d013")} <Icon name="arrowL" size={18} />
            </LocalizedClientLink>
            <div className="trustrow">
              <span><Icon name="lock" size={12} /> {t("sc2af64")}</span>
              <span><Icon name="refresh" size={12} /> {t("sab4bcb")}</span>
              <span><Icon name="truck" size={12} /> {t("s113808")}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="costicky">
        <div className="tot"><small>{t("sc58c52")}</small><b>{formatAmount(subtotal - discount)} {CUR}</b></div>
        <LocalizedClientLink href="/checkout" className="btn">{t("se4d013")} <Icon name="arrowL" size={15} /></LocalizedClientLink>
      </div>
    </div>
  )
}
