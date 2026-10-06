import Image from "next/image"
import { LoyaltyData } from "@lib/data/account"
import { orderNumber } from "@lib/util/eta"
import { formatAmount } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Signed from "@modules/common/components/signed"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ProfileForm, RedeemBox, SignOutButton } from "./account-client"
import { storeConfig } from "../../store.config"
import { g } from "@lib/voice"
import { products as nProducts, pieces as nPieces } from "@lib/util/plural"

type Props = {
  customer: HttpTypes.StoreCustomer
  loyalty: LoyaltyData | null
  orders: HttpTypes.StoreOrder[]
}

const { loyalty: L, checkout, currencyLabel: CUR } = storeConfig
// الميزات تُقرأ عند الرسم (تتغير من «إعدادات المتجر»)
const F = new Proxy({} as typeof storeConfig.features, { get: (_t, k) => (storeConfig.features as any)[k] })
const dateFmt = new Intl.DateTimeFormat("ar-OM", { day: "numeric", month: "long", timeZone: storeConfig.product.delivery.timezone })
const STATUS: Record<string, string> = { pending: "معلّقة حتى التوصيل", available: "متاحة", canceled: "ملغاة" }

function orderStage(o: HttpTypes.StoreOrder) {
  if (o.status === "canceled") return { t: "ملغى", c: "no" }
  // H14: التنفيذ الملغى لا يُحتسب
  const f = ((o.fulfillments ?? []) as any[]).filter((x) => !x.canceled_at)
  if (f.some((x) => x.delivered_at)) return { t: "تم التوصيل", c: "ok" }
  if (f.some((x) => x.shipped_at)) return { t: "في الطريق", c: "go" }
  return { t: "قيد التجهيز", c: "go" }
}

/** لوحة الحساب — مطابقة لصفحة «حسابي» في الديمو */
export default function AccountDashboard({ customer, loyalty, orders }: Props) {
  const name = customer.first_name || g("زبونتنا", "عميلنا", "عزيزنا")
  const phone = (customer.phone ?? "").replace(checkout.phone.prefix, "")
  const email = customer.email?.endsWith("@phone.invalid") ? "" : customer.email ?? ""
  const tier = loyalty?.tier
  const next = loyalty?.next_tier
  const confirmed = loyalty?.confirmed ?? 0
  const prog = next && tier ? Math.min(100, ((confirmed - tier.min) / (next.min - tier.min)) * 100) : 100
  const active = orders.filter((o) => orderStage(o).c === "go").length
  // الامتيازات الفعّالة: لمستواها وما دونه، وفقط ما له نص في الإعدادات (أي مُطبَّق فعلاً)
  const myPerks = (loyalty?.rules.tiers ?? [])
    .filter((t) => tier && t.min > 0 && t.min <= tier.min && L.tierPerks[t.key])
    .map((t) => L.tierPerks[t.key])

  return (
    <div className="wrap">
      <div className="secthead"><div><h1>حسابي</h1><p><bdi dir="ltr">{checkout.phone.prefix} {phone}</bdi></p></div></div>
      <div className="acct">
        <div>
          <div className="tierhead" data-testid="tierhead">
            <div className="top">
              <div className="av">{name.slice(0, 1)}</div>
              <div>
                <b className="hi">أهلاً {name}</b>
                {F.loyaltyTiers && tier && <span className="tier"><Icon name="sparkle" size={12} /> {g("عضوة", "عضو", "عضوية")} {tier.name} في نادي {storeConfig.shortName}</span>}
              </div>
            </div>
            {F.loyaltyTiers && myPerks.length > 0 && (
              <div className="myperks" data-testid="my-perks">
                {myPerks.map((p) => <span key={p}><Icon name="check" size={13} /> {p}</span>)}
              </div>
            )}
            {F.loyalty && (<>
            <div className="balances">
              <div data-testid="pts-available">
                <span>متاح للاستبدال</span>
                <b>{loyalty?.available ?? 0}</b>
                <small>= {formatAmount(((loyalty?.available ?? 0) / L.redeemPoints) * L.redeemValue)} {CUR}</small>
              </div>
              <div data-testid="pts-pending">
                <span>معلّق حتى التوصيل</span>
                <b>{loyalty?.pending ?? 0}</b>
                <small>تُتاح عند استلام طلبك</small>
              </div>
            </div>
            </>)}
            {F.loyaltyTiers && (<>
            <div className="pbar"><i style={{ width: `${prog}%` }} /></div>
            <div className="pl">
              <span>{tier?.name}</span>
              <span>{next ? `تبقّى ${next.min - confirmed} نقطة مؤكَّدة للعضوية ال${next.name}` : "أعلى مستوى — شكراً لوفائك"}</span>
            </div>
            </>)}
          </div>

          <div className="stats">
            <div><b>{orders.length}</b><span>طلبات</span></div>
            <div><b>{active}</b><span>طلب نشط</span></div>
            {F.loyalty && <div><b>{confirmed}</b><span>نقاط مؤكَّدة</span></div>}
          </div>

          {F.loyalty && (
          <div className="panelbox" style={{ marginTop: 16 }}>
            <h3>برنامج الولاء</h3>
            {F.loyaltyTiers && (
            <div className="tiers">
              {(loyalty?.rules.tiers ?? []).map((t) => (
                <div key={t.key} className={`t-${t.key} ${t.key === tier?.key ? "on" : ""}`}>
                  <i aria-hidden="true" />
                  <b>{t.name}</b>
                  {t.min ? `من ${t.min} نقطة` : "للجميع"}
                  {L.tierPerks[t.key] && <><br />{L.tierPerks[t.key]}</>}
                </div>
              ))}
            </div>
            )}
            <div className="earnlist">
              <div><span className="ic"><Icon name="bag" size={16} /></span>كل ريال تنفقينه<b><Signed sign="+" value={L.pointsPerUnit} /> نقاط</b></div>
            </div>
            <RedeemBox available={loyalty?.available ?? 0} />
            {!!loyalty?.entries.length && (
              <div className="ledger" data-testid="ledger">
                {loyalty.entries.slice(0, 8).map((e) => (
                  <div key={e.id} className="row">
                    <Icon name={e.kind === "redeem" ? "gift" : "box"} size={15} />
                    <div>
                      {e.kind === "redeem" ? <>استبدال — <bdi dir="ltr">{e.code}</bdi></> : <>طلب <bdi dir="ltr">{orderNumber(e.order_display_id)}</bdi></>}
                      {e.kind === "earn" && <> <span className={`pill-st ${e.status}`}>{STATUS[e.status]}</span></>}
                    </div>
                    <span className={`pts ${e.points < 0 ? "neg" : ""}`}><Signed sign={e.points > 0 ? "+" : "−"} value={Math.abs(e.points)} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        <div>
          <div className="panelbox orders">
            <h3>طلباتي</h3>
            {!orders.length && <p className="muted" style={{ fontSize: 13 }}>لا توجد طلبات بعد — طلباتك برقمك تظهر هنا تلقائياً.</p>}
            {orders.map((o) => {
              const st = orderStage(o)
              const n = orderNumber(o.display_id)
              return (
                <LocalizedClientLink key={o.id} href={`/track?no=${n}`} className="ord" data-testid="account-order">
                  <span className="thumbs3">
                    {(o.items ?? []).slice(0, 3).map((i) => (
                      <span key={i.id}>{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="34px" />}</span>
                    ))}
                  </span>
                  <div style={{ marginInlineStart: 8 }}>
                    <b><bdi dir="ltr">{n}</bdi></b>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {dateFmt.format(new Date(o.created_at as any))} · {nPieces((o.items ?? []).reduce((s, i) => s + i.quantity, 0))} · {formatAmount(o.total)} {CUR}
                    </div>
                  </div>
                  <span className={`st ${st.c}`}>{st.t}</span>
                </LocalizedClientLink>
              )
            })}
          </div>

          <div className="rowlinks">
            <LocalizedClientLink href="/track" className="rowlink"><span className="ic"><Icon name="truck" /></span><div>تتبّع طلب<span className="sub">برقم الطلب والهاتف</span></div><span className="chev"><Icon name="chevL" /></span></LocalizedClientLink>
            <LocalizedClientLink href="/account/wishlist" className="rowlink"><span className="ic"><Icon name="heart" /></span><div>المفضلة<span className="sub">{nProducts(((customer.metadata as any)?.wishlist ?? []).length)}</span></div><span className="chev"><Icon name="chevL" /></span></LocalizedClientLink>
            <a href={`https://wa.me/${storeConfig.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="rowlink"><span className="ic"><Icon name="whatsapp" /></span><div>{g("تواصلي معنا عبر واتساب", "تواصل معنا عبر واتساب")}<span className="sub">{storeConfig.contact.hours}</span></div><span className="chev"><Icon name="chevL" /></span></a>
          </div>

          <div style={{ marginTop: 16 }}>
            <ProfileForm first={customer.first_name ?? ""} last={customer.last_name ?? ""} email={email} />
          </div>
          <div className="rowlinks"><SignOutButton /></div>
        </div>
      </div>
    </div>
  )
}
