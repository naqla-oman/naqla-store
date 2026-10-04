"use client"

import { track } from "@lib/tracking/events"
import Image from "next/image"
import { applyCode, chooseShipping, DeliveryInput, placeOrderWith, removeCode, saveDelivery } from "@lib/data/checkout"
import { deliveryEta, governorateName, orderNumber } from "@lib/util/eta"
import { formatAmount } from "@lib/util/money"
import { orderMessage, waUrl } from "@lib/util/wa-order"
import { HttpTypes } from "@medusajs/types"
import Steps from "@modules/checkout/components/steps"
import Signed from "@modules/common/components/signed"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { storeConfig } from "../../../store.config"
import { g } from "@lib/voice"
import { tailoringNote } from "@lib/util/tailoring"

type Props = {
  cart: HttpTypes.StoreCart
  shippingOptions: HttpTypes.StoreCartShippingOption[]
  providers: string[]
  countryCode: string
  step: "address" | "payment"
  error?: string
  customer?: HttpTypes.StoreCustomer | null
}

const { checkout, currencyLabel: CUR } = storeConfig
const phoneRe = new RegExp(checkout.phone.pattern)
const URL_ERRORS: Record<string, string> = {
  thawani_cancelled: "أُلغي الدفع عبر ثواني ولم يُخصم أي مبلغ — يمكنك المحاولة مجدداً أو اختيار طريقة أخرى",
  thawani_unpaid: g("لم يكتمل الدفع عبر ثواني — لم يُسجَّل الطلب. حاولي مجدداً أو اختاري طريقة أخرى", "لم يكتمل الدفع عبر ثواني — لم يُسجَّل الطلب. حاول مجدداً أو اختر طريقة أخرى"),
  thawani_session: g("انتهت جلسة الدفع، أعيدي المحاولة", "انتهت جلسة الدفع، أعد المحاولة"),
}

type Errors = Partial<Record<"name" | "phone" | "province" | "city" | "email", string>>
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(f: DeliveryInput): Errors {
  const e: Errors = {}
  if (f.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = g("أدخلي اسمك الكامل (الاسم والعائلة)", "أدخل اسمك الكامل (الاسم والعائلة)")
  if (!phoneRe.test(f.phone)) e.phone = "رقم عُماني من 8 أرقام يبدأ بـ 9 أو 7"
  if (!f.province) e.province = g("اختاري المحافظة", "اختر المحافظة")
  if (!f.city.trim()) e.city = g("أدخلي الولاية", "أدخل الولاية")
  if (f.email.trim() && !emailRe.test(f.email.trim())) e.email = g("تحققي من البريد، مثال: name@example.com", "تحقق من البريد، مثال: name@example.com")
  return e
}

const fmt = (n: number) => `${formatAmount(n)} ${CUR}`

export default function CheckoutFlow({ cart, shippingOptions, providers, countryCode, step, error, customer }: Props) {
  const router = useRouter()
  const addr = cart.shipping_address
  const meta = (cart.metadata ?? {}) as Record<string, any>

  const [form, setForm] = useState<DeliveryInput>({
    name: [addr?.first_name, addr?.last_name].filter(Boolean).join(" ") || [customer?.first_name, customer?.last_name].filter(Boolean).join(" "),
    phone: (addr?.phone ?? customer?.phone ?? "").replace(checkout.phone.prefix, ""),
    email: cart.email?.endsWith("@phone.invalid") ? "" : cart.email ?? "",
    province: addr?.province ?? "",
    city: addr?.city ?? "",
    address: addr?.address_1 && addr.address_1 !== addr.city ? addr.address_1 : "",
    note: meta.courier_note ?? "",
    gift: !!meta.gift,
    giftMessage: meta.gift_message ?? "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sumOpen, setSumOpen] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(error ? URL_ERRORS[error] ?? null : null)
  const payments = checkout.payments.filter((p) => providers.includes(p.id))
  const [payId, setPayId] = useState(payments[0]?.id ?? "")
  const autoPicked = useRef(false)

  const errors = validate(form)
  const showErr = (k: keyof Errors) => (submitted ? errors[k] : undefined)
  const set = <K extends keyof DeliveryInput>(k: K, v: DeliveryInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  // ---- الأرقام ----
  const items = cart.items ?? []
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  // خصم التوصيل (امتياز المستوى) منفصل عن خصم المنتجات حتى لا يظهر مرتين
  const shipDiscount = (cart as any).shipping_discount_total ?? 0
  const discount = Math.max(0, (cart.discount_total ?? 0) - shipDiscount)
  // Store API يعيد is_automatic لكنه يخفي target_type ووصف العرض، فنستدل على امتياز التوصيل
  // بوجود عرض تلقائي مع خصم على التوصيل (عروض الأكواد اليدوية عندنا على المنتجات فقط)
  const perkPromo = shipDiscount > 0 ? (cart.promotions ?? []).find((p: any) => p.is_automatic) : undefined
  const method = cart.shipping_methods?.[0]
  const currentOptionId = method?.shipping_option_id
  const methodValid = !!currentOptionId && shippingOptions.some((o) => o.id === currentOptionId)
  const shipping = methodValid ? cart.shipping_total ?? 0 : null
  const total = shipping === null ? subtotal - discount : cart.total ?? subtotal - discount + shipping
  const currentOption = shippingOptions.find((o) => o.id === currentOptionId)
  const shipCode = (currentOption?.type as any)?.code as string | undefined
  const pay = payments.find((p) => p.id === payId)
  // الأكواد التي أدخلتها الزبونة فقط (العروض التلقائية كامتياز المستوى لا تُزال)
  const codes = (cart.promotions ?? []).filter((p: any) => !p.is_automatic).map((p) => p.code).filter(Boolean) as string[]

  const sortedOptions = useMemo(() => {
    const order = Object.keys(checkout.shipping)
    return [...shippingOptions].sort(
      (a, b) => order.indexOf((a.type as any)?.code) - order.indexOf((b.type as any)?.code)
    )
  }, [shippingOptions])

  // اختيار التوصيل العادي تلقائياً عند دخول خطوة الدفع (أو إن لم يعد الخيار السابق متاحاً للعنوان)
  useEffect(() => {
    if (step !== "payment" || methodValid || !sortedOptions.length || autoPicked.current) return
    autoPicked.current = true
    setBusy("ship")
    chooseShipping(sortedOptions[0].id).then(() => {
      setBusy(null)
      track("add_shipping_info", { value: subtotal - discount, shipping_tier: (sortedOptions[0].type as any)?.code, items: trackItems })
      router.refresh()
    })
  }, [step, methodValid, sortedOptions, router])

  // عناصر الطلب للتتبّع
  const trackItems = items.map((i) => ({ id: i.variant_id ?? i.id, name: i.product_title ?? i.title, price: i.unit_price, quantity: i.quantity, variant: i.variant_title ?? undefined }))
  // begin_checkout مرة عند فتح الدفع
  useEffect(() => {
    if (step === "address") track("begin_checkout", { value: subtotal - discount, items: trackItems })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s: "address" | "payment") => {
    router.push(`/${countryCode}/checkout?step=${s}`, { scroll: false })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const onSaveAddress = async (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    setFormError(null)
    if (Object.keys(errors).length) {
      const first = document.querySelector<HTMLElement>(".field.err input, .field.err select")
      first?.focus()
      return
    }
    setBusy("address")
    const r = await saveDelivery(form)
    setBusy(null)
    if (!r.ok) { setFormError(r.error); return }
    autoPicked.current = false
    router.refresh()
    go("payment")
  }

  const onShip = async (id: string) => {
    if (id === currentOptionId || busy) return
    setBusy("ship")
    const r = await chooseShipping(id)
    if (r.ok) track("add_shipping_info", { value: subtotal - discount, shipping_tier: (shippingOptions.find((o) => o.id === id)?.type as any)?.code, items: trackItems })
    setBusy(null)
    if (!r.ok) setPlaceError(r.error)
    router.refresh()
  }

  const onApply = async () => {
    setBusy("code")
    const r = await applyCode(code)
    setBusy(null)
    setCodeMsg(r.ok ? { ok: true, text: "تم تطبيق الخصم" } : { ok: false, text: r.error })
    if (r.ok) setCode("")
    router.refresh()
  }

  const onRemoveCode = async (c: string) => {
    setBusy("code")
    await removeCode(c)
    setBusy(null)
    setCodeMsg(null)
    router.refresh()
  }

  const onPlace = async () => {
    if (pay) track("add_payment_info", { value: total, payment_type: pay.key, items: trackItems })
    if (!pay) { setPlaceError(g("اختاري طريقة الدفع", "اختر طريقة الدفع")); return }
    if (!methodValid) { setPlaceError(g("اختاري طريقة التوصيل", "اختر طريقة التوصيل")); return }
    setPlaceError(null)
    // نافذة واتساب تُفتح الآن (ضمن ضغطة الزبونة) حتى لا يحجبها المتصفح، ثم نوجّهها بعد تسجيل الطلب
    const waWin = pay.key === "whatsapp" ? window.open("about:blank", "_blank") : null
    setBusy("place")
    const r = await placeOrderWith(pay.id, countryCode)
    if (!r.ok) { waWin?.close(); setBusy(null); setPlaceError(r.error); return }
    if (r.data?.redirectUrl) { window.location.href = r.data.redirectUrl; return }
    if (waWin && r.data) {
      waWin.location.href = waUrl(
        orderMessage({
          number: orderNumber(r.data.displayId),
          items: items.map((i) => ({ title: i.product_title ?? i.title, variant: i.variant_title, qty: i.quantity, length: (i.metadata as any)?.length_cm })),
          total,
          shipping: currentOption?.name,
          place: shipCode === "pickup" ? null : `${governorateName(form.province)} — ${form.city}`,
          name: form.name,
          gift: form.gift,
          giftMessage: form.giftMessage,
        })
      )
    }
    router.push(`/${countryCode}/order/${r.data!.orderId}/confirmed${pay.key === "whatsapp" ? "?via=whatsapp" : ""}`)
  }

  const placing = busy === "place"
  const ctaLabel = pay?.cta ?? "تأكيد الطلب"

  // ---- الملخص ----
  const summary = (
    <aside className="sumcol" hidden={step === "address" && !sumOpen ? true : undefined} id="sumBox">
      <div className="panelbox">
        <div className="sumhead"><h3>ملخص الطلب</h3><LocalizedClientLink href="/cart">تعديل السلة</LocalizedClientLink></div>
        {items.map((i) => {
          const len = (i.metadata as any)?.length_cm
          return (
            <div key={i.id} className="sumline">
              <div className="mini">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="44px" />}</div>
              <div className="n">
                <div>{i.product_title}</div>
                <div className="q">{i.variant_title?.replace(" / ", " · ")} × {i.quantity}{len ? ` · طول ${len} سم` : ""}</div>
                {tailoringNote(i.metadata) && <div className="q tnote">{tailoringNote(i.metadata)}</div>}
              </div>
              <span className="price num" style={{ fontSize: 13.5 }}>{formatAmount(i.unit_price * i.quantity)}</span>
            </div>
          )
        })}

        {!codes.length && (
          <div className="field" style={{ marginTop: 6 }}>
            <label htmlFor="coupon">كود الخصم</label>
            <div className="coupon">
              <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder={storeConfig.welcomeCode ? `مثال: ${storeConfig.welcomeCode.code}` : g("أدخلي الكود", "أدخل الكود")} autoComplete="off" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onApply() } }} />
              <button type="button" className="btn ghost" onClick={onApply} disabled={!code.trim() || busy === "code"}>{busy === "code" ? "…" : "تطبيق"}</button>
            </div>
            {codeMsg && !codeMsg.ok && <div className="ferr-inline" role="alert">{codeMsg.text}</div>}
          </div>
        )}
        {codeMsg?.ok && <div className="okmsg"><Icon name="check" size={12} /> {codeMsg.text}</div>}

        <div style={{ marginTop: 14 }}>
          <div className="trow"><span>المجموع</span><span>{fmt(subtotal)}</span></div>
          {discount > 0 && codes.map((c) => (
            <div key={c} className="trow">
              <span>خصم {c}<button type="button" className="rmcp" onClick={() => onRemoveCode(c)} disabled={busy === "code"}>إزالة</button></span>
              <span className="off"><Signed sign="−" value={formatAmount(discount)} /> {CUR}</span>
            </div>
          ))}
          {/* خصم تلقائي (امتياز مستوى مثل خصم التفصيل للماسية) بلا كود: سطر يشرح الفرق في الإجمالي */}
          {discount > 0 && !codes.length && (
            <div className="trow" data-testid="auto-discount">
              <span>خصم امتياز عضويتك</span>
              <span className="off"><Signed sign="−" value={formatAmount(discount)} /> {CUR}</span>
            </div>
          )}
          <div className="trow"><span>التوصيل</span><span data-testid="sum-shipping">{shipping === null ? "في الخطوة التالية" : shipping === 0 && shipDiscount > 0 ? <>مجاني <span className="perktag">امتياز عضويتك</span></> : shipping === 0 ? "مجاني" : fmt(shipping)}</span></div>
          <div className="trow final"><span>الإجمالي</span><span>{fmt(total)}</span></div>
        </div>

        {step === "payment" && methodValid && (
          <div className="etasum"><Icon name="truck" size={15} /> {deliveryEta(shipCode, form.province)}</div>
        )}
        {form.gift && (
          <div className="guest copper"><Icon name="gift" size={15} /> طلب هدية — تغليف فاخر وبطاقة برسالتك</div>
        )}

        {step === "payment" && (
          <>
            {placeError && <div className="alert" role="alert"><Icon name="x" size={15} /> {placeError}</div>}
            <button type="button" className="btn block lg" style={{ marginTop: 14 }} onClick={onPlace} disabled={placing || busy === "ship" || !methodValid} data-testid="place-order">
              <Icon name={pay?.key === "whatsapp" ? "whatsapp" : pay?.key === "thawani" ? "lock" : "check"} size={16} />
              {placing ? "جارٍ تأكيد الطلب…" : pay?.key === "thawani" ? "الدفع الآمن عبر ثواني" : pay?.key === "whatsapp" ? "إرسال الطلب عبر واتساب" : "تأكيد الطلب"}
            </button>
            <div className="trustrow">
              <span><Icon name="lock" size={12} /> دفع مشفّر</span>
              <span><Icon name="refresh" size={12} /> استبدال 14 يوماً</span>
              <span><Icon name="whatsapp" size={12} /> تأكيد عبر واتساب</span>
            </div>
          </>
        )}
      </div>
    </aside>
  )

  return (
    <div className="wrap has-costicky">
      <Steps current={step === "address" ? 1 : 2} />
      {customer ? (
        <div className="guest" data-testid="signed-in-note">
          <Icon name="user" size={15} /> {g("أنتِ داخلة بحسابك", "أنت داخل بحسابك", "تم الدخول بحسابك")}{customer.first_name ? ` يا ${customer.first_name}` : ""}{storeConfig.features.loyalty ? " — ستُضاف نقاط هذا الطلب لرصيدك" : ""}
        </div>
      ) : (
        <div className="guest" data-testid="guest-note">
          <Icon name="user" size={15} /> {g("لا حاجة لإنشاء حساب — أكملي كضيفة، أو", "لا حاجة لإنشاء حساب — أكمل كضيف، أو", "لا حاجة لإنشاء حساب — أكمل الطلب مباشرة، أو")}{" "}
          <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>{g("ادخلي برقمك", "ادخل برقمك")}</LocalizedClientLink>{storeConfig.features.loyalty ? g(" لتكسبي نقاط الولاء", " لتكسب نقاط الولاء") : " لحفظ طلباتك"}
        </div>
      )}
      <button type="button" className="sumtoggle" aria-expanded={step === "payment" || sumOpen} aria-controls="sumBox" onClick={() => setSumOpen((v) => !v)}>
        <Icon name="bag" size={16} /> {items.reduce((s, i) => s + i.quantity, 0)} منتجات في طلبك <b className="num">{fmt(total)}</b> <Icon name="chevD" size={14} />
      </button>

      <div className="checkout">
        <div>
          {step === "address" ? (
            <form className="panelbox" onSubmit={onSaveAddress} noValidate>
              <h3>بيانات التوصيل</h3>
              <div className="f2">
                <div className={`field ${showErr("name") ? "err" : ""}`}>
                  <label htmlFor="fName">الاسم الكامل</label>
                  <input id="fName" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: مريم الهنائية" autoComplete="name" aria-invalid={!!showErr("name")} aria-describedby="eName" />
                  <span className="ferr" id="eName">{showErr("name")}</span>
                </div>
                <div className={`field ${showErr("phone") ? "err" : ""}`}>
                  <label htmlFor="fPhone">رقم الهاتف</label>
                  <div className="phone">
                    <input id="fPhone" type="tel" inputMode="numeric" maxLength={8} value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={checkout.phone.placeholder} autoComplete="tel-national" dir="ltr" aria-invalid={!!showErr("phone")} aria-describedby="ePhone" />
                    <span className="pre">{checkout.phone.prefix}</span>
                  </div>
                  <span className="ferr" id="ePhone">{showErr("phone")}</span>
                </div>
              </div>
              <div className="f2">
                <div className={`field ${showErr("province") ? "err" : ""}`}>
                  <label htmlFor="fGov">المحافظة</label>
                  <select id="fGov" value={form.province} onChange={(e) => set("province", e.target.value)} aria-invalid={!!showErr("province")} aria-describedby="eGov">
                    <option value="">{g("اختاري المحافظة", "اختر المحافظة")}</option>
                    {checkout.governorates.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
                  </select>
                  <span className="ferr" id="eGov">{showErr("province")}</span>
                </div>
                <div className={`field ${showErr("city") ? "err" : ""}`}>
                  <label htmlFor="fCity">الولاية</label>
                  <input id="fCity" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="مثال: السيب" autoComplete="address-level2" aria-invalid={!!showErr("city")} aria-describedby="eCity" />
                  <span className="ferr" id="eCity">{showErr("city")}</span>
                </div>
              </div>
              <div className={`field ${showErr("email") ? "err" : ""}`}>
                <label htmlFor="fEmail">البريد الإلكتروني <span style={{ fontWeight: 400 }}>(اختياري)</span></label>
                <input id="fEmail" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" autoComplete="email" dir="ltr" style={{ textAlign: "start" }} aria-invalid={!!showErr("email")} aria-describedby="eEmail" />
                <span className="ferr" id="eEmail">{showErr("email")}</span>
              </div>
              <div className="field">
                <label htmlFor="fAddr">العنوان التفصيلي</label>
                <input id="fAddr" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="الحي، رقم المنزل، معلم قريب" autoComplete="street-address" />
              </div>
              <div className="field">
                <label htmlFor="fNote">ملاحظات للمندوب (اختياري)</label>
                <input id="fNote" value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="مثال: الاتصال قبل الوصول" />
              </div>
              {storeConfig.features.gift && (<>
              <button type="button" className={`giftrow ${form.gift ? "on" : ""}`} role="switch" aria-checked={form.gift} onClick={() => set("gift", !form.gift)}>
                <Icon name="gift" size={22} />
                <span><b>هذه هدية</b><span className="d">{checkout.giftNote}</span></span>
                <span className="sw" aria-hidden="true" />
              </button>
              {form.gift && (
                <div className="field">
                  <label htmlFor="fGift">رسالة البطاقة</label>
                  <textarea id="fGift" value={form.giftMessage} maxLength={200} onChange={(e) => set("giftMessage", e.target.value)} placeholder={g("مثال: كل عام وأنتِ بخير يا أمي", "مثال: كل عام وأنت بخير", "مثال: كل عام وأنتم بخير")} />
                </div>
              )}
              </>)}
              {formError && <div className="alert" role="alert"><Icon name="x" size={15} /> {formError}</div>}
              <div style={{ marginTop: 18 }}>
                <button type="submit" className="btn block lg" disabled={busy === "address"} data-testid="to-payment">
                  {busy === "address" ? "جارٍ الحفظ…" : "متابعة إلى الدفع"} <Icon name="arrowL" size={18} />
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="panelbox">
                <h3>العنوان</h3>
                <div className="addrcard">
                  <Icon name="pin" size={16} />
                  <div>
                    <b>{form.name}</b> · <bdi dir="ltr">{checkout.phone.prefix} {form.phone}</bdi><br />
                    <span className="muted">{governorateName(form.province)} — {form.city}{form.address ? `، ${form.address}` : ""}</span>
                  </div>
                  <button type="button" onClick={() => go("address")}>تعديل</button>
                </div>
              </div>

              <div className="panelbox" role="radiogroup" aria-label="طريقة التوصيل">
                <h3>طريقة التوصيل</h3>
                {!customer && storeConfig.loyalty.freeShippingTier && (
                  <div className="guest copper" data-testid="gold-hint">
                    <Icon name="sparkle" size={15} />
                    <span>
                      {g(
                        `عضوة ${storeConfig.loyalty.freeShippingTier.name}؟`,
                        `عضو ${storeConfig.loyalty.freeShippingTier.name.replace(/ة$/, "")}؟`,
                        `عضوية ${storeConfig.loyalty.freeShippingTier.name}؟`
                      )}{" "}
                      <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>
                        {g("سجّلي الدخول برقمك", "سجّل الدخول برقمك")}
                      </LocalizedClientLink>{" "}
                      ليصبح التوصيل مجانياً
                    </span>
                  </div>
                )}
                {!sortedOptions.length && <div className="alert">لا توجد طريقة توصيل متاحة لهذا العنوان — {g("تواصلي معنا على واتساب", "تواصل معنا على واتساب")}</div>}
                {sortedOptions.map((o) => {
                  const c = (o.type as any)?.code as string
                  const on = o.id === currentOptionId && methodValid
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} className={`payopt ${on ? "on" : ""}`} onClick={() => onShip(o.id)} disabled={busy === "ship"}>
                      <span className="ic"><Icon name={checkout.shipping[c]?.icon ?? "truck"} /></span>
                      <span className="t"><b>{o.name}</b><span>{c === "standard" ? deliveryEta(c, form.province) : (o.type as any)?.description}</span></span>
                      <span className={`pr ${o.amount === 0 || perkPromo ? "free" : ""}`}>
                        {o.amount === 0 ? "مجاني" : perkPromo ? <><s className="old">{formatAmount(o.amount ?? 0)}</s> مجاني</> : fmt(o.amount ?? 0)}
                      </span>
                      <span className="mark" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>

              <div className="panelbox" role="radiogroup" aria-label="طريقة الدفع">
                <h3>طريقة الدفع</h3>
                {payments.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.id === payId} className={`payopt ${p.id === payId ? "on" : ""}`} onClick={() => setPayId(p.id)} data-testid={`pay-${p.key}`}>
                    <span className={`ic ${p.key === "whatsapp" ? "wa" : ""}`}><Icon name={p.icon} /></span>
                    <span className="t">
                      <b>{p.title}</b><span>{p.desc}</span>
                      {"logos" in p && p.logos && (
                        <span className="plogos">{p.logos.map((l) => <span key={l}><img src={`/img/pay/${l}`} alt="" /></span>)}</span>
                      )}
                    </span>
                    <span className="mark" aria-hidden="true" />
                  </button>
                ))}
                <div className="secure"><Icon name="lock" size={14} /> بياناتك مشفّرة ولا نحفظ تفاصيل بطاقتك</div>
                <div className="after">
                  <div><Icon name="whatsapp" size={16} />تأكيد الطلب على واتساب</div>
                  <div><Icon name="scissors" size={16} />تجهيز وكيّ في المشغل</div>
                  <div><Icon name="truck" size={16} />توصيل حتى بابك</div>
                </div>
              </div>
            </>
          )}
        </div>
        {summary}
      </div>

      <div className="costicky">
        <div className="tot"><small>{shipping === null ? "الإجمالي قبل التوصيل" : "الإجمالي شامل التوصيل"}</small><b>{fmt(total)}</b></div>
        {step === "address" ? (
          <button type="button" className="btn" onClick={() => onSaveAddress()} disabled={busy === "address"}>متابعة إلى الدفع <Icon name="arrowL" size={15} /></button>
        ) : (
          <button type="button" className="btn" onClick={onPlace} disabled={placing || busy === "ship" || !methodValid}>{placing ? "جارٍ التأكيد…" : ctaLabel}</button>
        )}
      </div>
    </div>
  )
}
