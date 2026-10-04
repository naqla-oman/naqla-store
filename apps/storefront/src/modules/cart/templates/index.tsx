import { HttpTypes } from "@medusajs/types"
import Signed from "@modules/common/components/signed"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import Steps from "@modules/checkout/components/steps"
import { formatAmount } from "@lib/util/money"
import CartLines from "./lines"
import { storeConfig } from "../../../store.config"

/** صفحة السلة — الخطوة الأولى (مطابقة لسلة الديمو) */
export default function CartTemplate({ cart }: { cart: HttpTypes.StoreCart | null }) {
  const items = cart?.items ?? []
  const count = items.reduce((s, i) => s + i.quantity, 0)

  if (!cart || !items.length) {
    return (
      <div className="wrap">
        <Steps current={0} />
        <div className="empty">
          <Icon name="bag" size={46} />
          <p>سلتك فارغة بعد</p>
          <LocalizedClientLink href="/store" className="btn">ابدئي التسوق</LocalizedClientLink>
        </div>
      </div>
    )
  }

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const discount = Math.max(0, (cart.discount_total ?? 0) - ((cart as any).shipping_discount_total ?? 0))
  const freeOver = storeConfig.freeShippingOver
  const left = Math.max(0, freeOver - (subtotal - discount))

  return (
    <div className="wrap has-costicky">
      <Steps current={0} />
      <h1 className="pagehead">سلة التسوق <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>({count})</span></h1>
      <div className="cartpage">
        <div className="panelbox">
          <div className="shipbar">
            {left > 0 ? (
              <>أضيفي <b>{formatAmount(left)} {storeConfig.currencyLabel}</b> لتحصلي على توصيل مجاني</>
            ) : (
              <><Icon name="check" size={14} /> حصلتِ على التوصيل المجاني</>
            )}
            <div className="bar"><i style={{ width: `${Math.min(100, ((subtotal - discount) / freeOver) * 100)}%` }} /></div>
          </div>
          <CartLines items={items} />
        </div>

        <aside className="sumcol">
          <div className="panelbox">
            <h3>ملخص الطلب</h3>
            <div style={{ marginTop: 12 }}>
              <div className="trow"><span>المجموع</span><span>{formatAmount(subtotal)} {storeConfig.currencyLabel}</span></div>
              {discount > 0 && (
                <div className="trow">
                  <span>الخصم {cart.promotions?.map((p) => p.code).join("، ")}</span>
                  <span className="off"><Signed sign="−" value={formatAmount(discount)} /> {storeConfig.currencyLabel}</span>
                </div>
              )}
              <div className="trow"><span>التوصيل</span><span>{left > 0 ? "حسب العنوان" : "مجاني"}</span></div>
              <div className="trow final"><span>الإجمالي</span><Money amount={subtotal - discount} className="" /></div>
            </div>
            <LocalizedClientLink href="/checkout" className="btn block lg" data-testid="checkout-button">
              إتمام الطلب <Icon name="arrowL" size={18} />
            </LocalizedClientLink>
            <div className="trustrow">
              <span><Icon name="lock" size={12} /> دفع آمن</span>
              <span><Icon name="refresh" size={12} /> استبدال 14 يوماً</span>
              <span><Icon name="truck" size={12} /> لكل المحافظات</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="costicky">
        <div className="tot"><small>الإجمالي قبل التوصيل</small><b>{formatAmount(subtotal - discount)} {storeConfig.currencyLabel}</b></div>
        <LocalizedClientLink href="/checkout" className="btn">إتمام الطلب <Icon name="arrowL" size={15} /></LocalizedClientLink>
      </div>
    </div>
  )
}
