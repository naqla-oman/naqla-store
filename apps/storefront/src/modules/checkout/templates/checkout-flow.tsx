"use client"

import { expressOpen } from "@lib/util/eta"
import { includedTax } from "@lib/util/tax"
import { track } from "@lib/tracking/events"
import Image from "next/image"
import { applyCode, chooseShipping, DeliveryInput, placeOrderWith, removeCode, saveDelivery } from "@lib/data/checkout"
import { deliveryEta, orderNumber } from "@lib/util/eta"
import { formatAmount } from "@lib/util/money"
import { orderMessage, waUrl } from "@lib/util/wa-order"
import { HttpTypes } from "@medusajs/types"
import Steps from "@modules/checkout/components/steps"
import Signed from "@modules/common/components/signed"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams, useRouter } from "next/navigation"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { storeConfig } from "../../../store.config"
import { tailoringNote } from "@lib/util/tailoring"
import { pieces as nPieces } from "@lib/util/plural"
import { discountLines } from "@lib/util/discounts"
import { langPrefix } from "@/i18n/config"
import { useLocale } from "next-intl"
import { useCurrencyLabel, useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"
import { placeLabel } from "@lib/util/labels"

type Props = {
  cart: HttpTypes.StoreCart
  shippingOptions: HttpTypes.StoreCartShippingOption[]
  providers: string[]
  countryCode: string
  step: "address" | "payment"
  error?: string
  customer?: HttpTypes.StoreCustomer | null
  /** تبويب «التوصيل»: المحافظات المفعّلة من Medusa (null = كلها) */
  enabledGovernorates?: string[] | null
}

const { checkout } = storeConfig
const phoneRe = new RegExp(checkout.phone.pattern)
type T = (key: string, vals?: Record<string, string | number>) => string
const urlError = (t: T, code: string) => ({ thawani_cancelled: t("sca3c24"), thawani_unpaid: t("sc6e7f1"), thawani_session: t("s5096b5") } as Record<string, string>)[code]

type Errors = Partial<Record<"name" | "phone" | "province" | "city" | "email", string>>
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(f: DeliveryInput, t: T): Errors {
  const e: Errors = {}
  if (f.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = t("sfcf29c")
  if (!phoneRe.test(f.phone)) e.phone = t("se31171")
  // منخفضة: الاستلام من المحل لا يطلب محافظة ولا ولاية
  if (!f.pickup && !f.province) e.province = t("se494ea")
  if (f.pickup) { /* عنوان المحل يُملأ عند الحفظ */ }
  else if (!f.city.trim()) e.city = t("s2aac38")
  else {
    const list = checkout.governorates.find((x) => x.code === f.province)?.wilayats ?? []
    if (list.length && !list.includes(f.city)) e.city = t("sac09bf")
  }
  if (f.email.trim() && !emailRe.test(f.email.trim())) e.email = t("s1371d9")
  return e
}


export default function CheckoutFlow({ cart, shippingOptions, providers, countryCode, step, error, customer, enabledGovernorates }: Props) {
  const sc = useStoreConfig()
  const t = useT("checkout")
  const CUR = useCurrencyLabel()
  const locale = useLocale()
  const fmt = (n: number) => `${formatAmount(n)} ${CUR}`
  const govOptions = checkout.governorates.filter((x) => !enabledGovernorates || enabledGovernorates.includes(x.code))
  const router = useRouter()
  const { lang } = useParams<{ lang: string }>()
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
    pickup: !!meta.pickup,
  })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sumOpen, setSumOpen] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(error ? urlError(t, error) ?? null : null)
  // القيم (رموز المحافظات وأسماء الولايات) تبقى بالعربية كما تُخزَّن في العنوان؛ التسميات بلغة الصفحة
  const loc = sc.checkout
  const govLabel = (code: string) => loc.governorates.find((x) => x.code === code)?.name ?? checkout.governorates.find((x) => x.code === code)?.name ?? code
  const wilLabel = (code: string, w: string) => {
    const ar = checkout.governorates.find((x) => x.code === code)?.wilayats ?? []
    const i = ar.indexOf(w)
    return (i >= 0 && loc.governorates.find((x) => x.code === code)?.wilayats?.[i]) || w
  }
  const payments = loc.payments.filter((p) => providers.includes(p.id))
  const [payId, setPayId] = useState(payments[0]?.id ?? "")
  const autoPicked = useRef(false)

  const errors = validate(form, t)
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
    // M13: السريع «اليوم» يُخفى بعد ساعة القطع وفي أيام العطلة (والخادم يرفضه أيضاً)
    const open = expressOpen()
    const order = Object.keys(checkout.shipping)
    return [...shippingOptions].filter((o) => open || (o.type as any)?.code !== "express").sort(
      (a, b) => order.indexOf((a.type as any)?.code) - order.indexOf((b.type as any)?.code)
    )
  }, [shippingOptions])

  // اختيار التوصيل العادي تلقائياً عند دخول خطوة الدفع (أو إن لم يعد الخيار السابق متاحاً للعنوان)
  useEffect(() => {
    if (step !== "payment" || methodValid || !sortedOptions.length || autoPicked.current) return
    autoPicked.current = true
    setBusy("ship")
    // الاستلام من المحل ← خيار الاستلام؛ وإلا الأول (العادي)
    const pick = (form.pickup && sortedOptions.find((o) => (o.type as any)?.code === "pickup")) || sortedOptions[0]
    chooseShipping(pick.id).then(() => {
      setBusy(null)
      track("add_shipping_info", { value: subtotal - discount, shipping_tier: (pick.type as any)?.code, items: trackItems })
      router.refresh()
    })
    // trackItems للتتبع فقط (معرَّف بعد هذا التأثير)؛ autoPicked يمنع التكرار
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, methodValid, sortedOptions, router, form.pickup, discount, subtotal])

  // عناصر الطلب للتتبّع
  const trackItems = items.map((i) => ({ id: i.variant_id ?? i.id, name: i.product_title ?? i.title, price: i.unit_price, quantity: i.quantity, variant: i.variant_title ?? undefined }))
  // begin_checkout مرة عند فتح الدفع
  useEffect(() => {
    if (step === "address") track("begin_checkout", { value: subtotal - discount, items: trackItems })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s: "address" | "payment") => {
    router.push(`/${countryCode}${langPrefix(lang)}/checkout?step=${s}`, { scroll: false })
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
    setCodeMsg(r.ok ? { ok: true, text: t("sf67794") } : { ok: false, text: r.error })
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
    if (!pay) { setPlaceError(t("sf18fa8")); return }
    if (!methodValid) { setPlaceError(t("se87ef1")); return }
    setPlaceError(null)
    // نافذة واتساب تُفتح الآن (ضمن ضغطة الزبونة) حتى لا يحجبها المتصفح، ثم نوجّهها بعد تسجيل الطلب
    const waWin = pay.key === "whatsapp" ? window.open("about:blank", "_blank") : null
    setBusy("place")
    const r = await placeOrderWith(pay.id, countryCode)
    if (!r.ok) { waWin?.close(); setBusy(null); setPlaceError(r.error); return }
    if (r.data?.redirectUrl) { window.location.href = r.data.redirectUrl; return }
    if (waWin && r.data) {
      waWin.location.href = waUrl(
        orderMessage(t, CUR, {
          number: orderNumber(r.data.displayId),
          items: items.map((i) => ({ title: i.product_title ?? i.title, variant: i.variant_title, qty: i.quantity, length: (i.metadata as any)?.length_cm })),
          total,
          shipping: currentOption?.name,
          place: shipCode === "pickup" ? null : `${placeLabel(sc, form.province, form.city)}`,
          name: form.name,
          gift: form.gift,
          giftMessage: form.giftMessage,
        })
      )
    }
    router.push(`/${countryCode}${langPrefix(lang)}/order/${r.data!.orderId}/confirmed${pay.key === "whatsapp" ? "?via=whatsapp" : ""}`)
  }

  const placing = busy === "place"
  const ctaLabel = pay?.cta ?? t("s438227")

  // ---- الملخص ----
  const summary = (
    <aside className="sumcol" hidden={step === "address" && !sumOpen ? true : undefined} id="sumBox">
      <div className="panelbox">
        <div className="sumhead"><h3>{t("seeea12")}</h3><LocalizedClientLink href="/cart">{t("sb4d933")}</LocalizedClientLink></div>
        {items.map((i) => {
          const len = (i.metadata as any)?.length_cm
          return (
            <div key={i.id} className="sumline">
              <div className="mini">{i.thumbnail && <Image src={i.thumbnail} alt="" fill sizes="44px" />}</div>
              <div className="n">
                <div>{i.product_title}</div>
                <div className="q">{i.variant_title?.replace(" / ", " · ")} × {i.quantity}{len ? t("lengthNote", { len }) : ""}</div>
                {tailoringNote(i.metadata, t, sc) && <div className="q tnote">{tailoringNote(i.metadata, t, sc)}</div>}
              </div>
              <span className="price num" style={{ fontSize: 13.5 }}>{formatAmount(i.unit_price * i.quantity)}</span>
            </div>
          )
        })}

        {!codes.length && (
          <div className="field" style={{ marginTop: 6 }}>
            <label htmlFor="coupon">{t("sc38a00")}</label>
            <div className="coupon">
              <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder={sc.welcomeCode ? t("example", { code: sc.welcomeCode.code }) : t("s95b4c5")} autoComplete="off" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onApply() } }} />
              <button type="button" className="btn ghost" onClick={onApply} disabled={!code.trim() || busy === "code"}>{busy === "code" ? "…" : t("sabe315")}</button>
            </div>
            {codeMsg && !codeMsg.ok && <div className="ferr-inline" role="alert">{codeMsg.text}</div>}
          </div>
        )}
        {codeMsg?.ok && <div className="okmsg"><Icon name="check" size={12} /> {codeMsg.text}</div>}

        <div style={{ marginTop: 14 }}>
          <div className="trow"><span>{t("s7512af")}</span><span>{fmt(subtotal)}</span></div>
          {/* منخفضة: سطر لكل عرض بمبلغه الفعلي — الكود (قابل للإزالة) منفصل عن امتياز المستوى */}
          {discount > 0 && discountLines(t, cart.items, cart.promotions as any).map((d) => (
            <div key={d.code} className="trow" data-testid={d.auto ? "auto-discount" : "discount-line"}>
              <span>
                {d.label}
                {!d.auto && <button type="button" className="rmcp" onClick={() => onRemoveCode(d.code)} disabled={busy === "code"}>{t("seed790")}</button>}
              </span>
              <span className="off"><Signed sign="−" value={formatAmount(d.amount)} /> {CUR}</span>
            </div>
          ))}
          <div className="trow"><span>{t("s30ecbc")}</span><span data-testid="sum-shipping">{shipping === null ? t("nextStep") : shipping === 0 && shipDiscount > 0 ? <>{t("s5abc46")} <span className="perktag">{t("sd15fc0")}</span></> : shipping === 0 ? t("free") : fmt(shipping)}</span></div>
          <div className="trow final"><span>{t("s88fc73")}</span><span>{fmt(total)}</span></div>
              {/* M15: الضريبة المضمَّنة في الإجمالي */}
              {(() => {
                const tax = includedTax(total, shipping === null ? null : (cart as any).tax_total)
                return tax.rate > 0 ? <div className="trow taxnote" data-testid="tax-line"><span>{t("taxIncluded", { rate: tax.rate })}</span><span>{fmt(tax.amount)}</span></div> : null
              })()}
        </div>

        {step === "payment" && methodValid && (
          <div className="etasum"><Icon name="truck" size={15} /> {deliveryEta(t, locale, shipCode, form.province)}</div>
        )}
        {form.gift && (
          <div className="guest copper"><Icon name="gift" size={15} /> {t("sf84e5a")}</div>
        )}

        {step === "payment" && (
          <>
            {placeError && <div className="alert" role="alert"><Icon name="x" size={15} /> {placeError}</div>}
            <button type="button" className="btn block lg" style={{ marginTop: 14 }} onClick={onPlace} disabled={placing || busy === "ship" || !methodValid} data-testid="place-order">
              <Icon name={pay?.key === "whatsapp" ? "whatsapp" : pay?.key === "thawani" ? "lock" : "check"} size={16} />
              {placing ? t("placing") : pay?.key === "thawani" ? t("payThawani") : pay?.key === "whatsapp" ? t("sendWhatsapp") : t("s438227")}
            </button>
            <div className="trustrow">
              <span><Icon name="lock" size={12} /> {t("sa97f7e")}</span>
              <span><Icon name="refresh" size={12} /> {t("sab4bcb")}</span>
              <span><Icon name="whatsapp" size={12} /> {t("s80bb43")}</span>
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
          <Icon name="user" size={15} /> {t("s8660e0")}{customer.first_name ? t("hiName", { name: customer.first_name }) : ""}{sc.features.loyalty ? t("pointsNote") : ""}
        </div>
      ) : (
        <div className="guest" data-testid="guest-note">
          <Icon name="user" size={15} /> {t("s099ef5")}{" "}
          <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>{t("s33c19c")}</LocalizedClientLink>{sc.features.loyalty ? t("sa9d64f") : t("sbe32b2")}
        </div>
      )}
      <button type="button" className="sumtoggle" aria-expanded={step === "payment" || sumOpen} aria-controls="sumBox" onClick={() => setSumOpen((v) => !v)}>
        <Icon name="bag" size={16} /> {t("itemsInOrder", { count: items.reduce((s, i) => s + i.quantity, 0) })} <b className="num">{fmt(total)}</b> <Icon name="chevD" size={14} />
      </button>

      <div className="checkout">
        <div>
          {step === "address" ? (
            <form className="panelbox" onSubmit={onSaveAddress} noValidate>
              <h3>{t("s85aedb")}</h3>
              <div className="f2">
                <div className={`field ${showErr("name") ? "err" : ""}`}>
                  <label htmlFor="fName">{t("s90f911")}</label>
                  <input id="fName" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("s356d24")} autoComplete="name" aria-invalid={!!showErr("name")} aria-describedby="eName" />
                  <span className="ferr" id="eName">{showErr("name")}</span>
                </div>
                <div className={`field ${showErr("phone") ? "err" : ""}`}>
                  <label htmlFor="fPhone">{t("s0947ad")}</label>
                  <div className="phone">
                    <input id="fPhone" type="tel" inputMode="numeric" maxLength={8} value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={checkout.phone.placeholder} autoComplete="tel-national" dir="ltr" aria-invalid={!!showErr("phone")} aria-describedby="ePhone" />
                    <span className="pre">{checkout.phone.prefix}</span>
                  </div>
                  <span className="ferr" id="ePhone">{showErr("phone")}</span>
                </div>
              </div>
              {/* منخفضة: استلام من المحل بلا عنوان */}
              {sc.seo.shipping.some((s) => s.code === "pickup") && (
                <div className="seg2" role="radiogroup" aria-label={t("sdf3035")} data-testid="pickup-toggle">
                  <button type="button" role="radio" aria-checked={!form.pickup} className={!form.pickup ? "on" : ""} onClick={() => set("pickup", false)}>{t("s3a3dce")}</button>
                  <button type="button" role="radio" aria-checked={!!form.pickup} className={form.pickup ? "on" : ""} onClick={() => set("pickup", true)}>{t("pickupFrom", { place: sc.seo.location.name })}</button>
                </div>
              )}
              {!form.pickup && (
              <div className="f2">
                <div className={`field ${showErr("province") ? "err" : ""}`}>
                  <label htmlFor="fGov">{t("sd51135")}</label>
                  <select
                    id="fGov"
                    value={form.province}
                    onChange={(e) => {
                      const code = e.target.value
                      set("province", code)
                      // الولاية السابقة لا تنتمي للمحافظة الجديدة ← تُفرَّغ
                      const list = checkout.governorates.find((x) => x.code === code)?.wilayats ?? []
                      if (list.length && !list.includes(form.city)) set("city", "")
                    }}
                    aria-invalid={!!showErr("province")}
                    aria-describedby="eGov"
                  >
                    <option value="">{t("se494ea")}</option>
                    {govOptions.map((g) => <option key={g.code} value={g.code}>{govLabel(g.code)}</option>)}
                  </select>
                  <span className="ferr" id="eGov">{showErr("province")}</span>
                </div>
                <div className={`field ${showErr("city") ? "err" : ""}`}>
                  <label htmlFor="fCity">{t("s03b4c3")}</label>
                  {/* M18: قائمة ولايات المحافظة المختارة (61 ولاية) بدل نص حر */}
                  {(() => {
                    const list = checkout.governorates.find((x) => x.code === form.province)?.wilayats ?? []
                    return list.length ? (
                      <select id="fCity" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" aria-invalid={!!showErr("city")} aria-describedby="eCity">
                        <option value="">{t("s2aac38")}</option>
                        {list.map((w) => <option key={w} value={w}>{wilLabel(form.province, w)}</option>)}
                      </select>
                    ) : (
                      <select id="fCity" value="" disabled aria-describedby="eCity">
                        <option value="">{t("s379cc7")}</option>
                      </select>
                    )
                  })()}
                  <span className="ferr" id="eCity">{showErr("city")}</span>
                </div>
              </div>
              )}
              {!form.pickup && (
              <div className={`field ${showErr("email") ? "err" : ""}`}>
                <label htmlFor="fEmail">{t("s2436aa")} <span style={{ fontWeight: 400 }}>{t("s836573")}</span></label>
                <input id="fEmail" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" autoComplete="email" dir="ltr" style={{ textAlign: "start" }} aria-invalid={!!showErr("email")} aria-describedby="eEmail" />
                <span className="ferr" id="eEmail">{showErr("email")}</span>
              </div>
              )}
              <div className="field">
                <label htmlFor="fAddr">{t("sa5814c")}</label>
                <input id="fAddr" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={t("scaf32b")} autoComplete="street-address" />
              </div>
              <div className="field">
                <label htmlFor="fNote">{t("s4e1676")}</label>
                <input id="fNote" value={form.note} onChange={(e) => set("note", e.target.value)} placeholder={t("s218308")} />
              </div>
              {sc.features.gift && (<>
              <button type="button" className={`giftrow ${form.gift ? "on" : ""}`} role="switch" aria-checked={form.gift} onClick={() => set("gift", !form.gift)}>
                <Icon name="gift" size={22} />
                <span><b>{t("sdb8be7")}</b><span className="d">{loc.giftNote}</span></span>
                <span className="sw" aria-hidden="true" />
              </button>
              {form.gift && (
                <div className="field">
                  <label htmlFor="fGift">{t("s070822")}</label>
                  <textarea id="fGift" value={form.giftMessage} maxLength={200} onChange={(e) => set("giftMessage", e.target.value)} placeholder={t("s41dd18")} />
                </div>
              )}
              </>)}
              {formError && <div className="alert" role="alert"><Icon name="x" size={15} /> {formError}</div>}
              <div style={{ marginTop: 18 }}>
                <button type="submit" className="btn block lg" disabled={busy === "address"} data-testid="to-payment">
                  {busy === "address" ? t("saving") : t("s42f5cd")} <Icon name="arrowL" size={18} />
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="panelbox">
                <h3>{t("s6dc658")}</h3>
                <div className="addrcard">
                  <Icon name="pin" size={16} />
                  <div>
                    <b>{form.name}</b> · <bdi dir="ltr">{checkout.phone.prefix} {form.phone}</bdi><br />
                    <span className="muted">{placeLabel(sc, form.province, form.city)}{form.address ? `${t("sep")}${form.address}` : ""}</span>
                  </div>
                  <button type="button" onClick={() => go("address")}>{t("s759fdc")}</button>
                </div>
              </div>

              <div className="panelbox" role="radiogroup" aria-label={t("sb02f7e")}>
                <h3>{t("sb02f7e")}</h3>
                {!customer && sc.loyalty.freeShippingTier && (
                  <div className="guest copper" data-testid="gold-hint">
                    <Icon name="sparkle" size={15} />
                    <span>
                      {t("tierMember", { tier: sc.loyalty.freeShippingTier.name, tierM: sc.loyalty.freeShippingTier.name.replace(/ة$/, "") })}{" "}
                      <LocalizedClientLink href="/account" style={{ textDecoration: "underline" }}>
                        {t("s60746c")}
                      </LocalizedClientLink>{" "}
                      {t("forFreeShipping")}
                    </span>
                  </div>
                )}
                {!sortedOptions.length && <div className="alert">{t("noShipping")} — {t("sa83f06")}</div>}
                {sortedOptions.map((o) => {
                  const c = (o.type as any)?.code as string
                  const on = o.id === currentOptionId && methodValid
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} className={`payopt ${on ? "on" : ""}`} onClick={() => onShip(o.id)} disabled={busy === "ship"}>
                      <span className="ic"><Icon name={checkout.shipping[c]?.icon ?? "truck"} /></span>
                      <span className="t"><b>{o.name}</b><span>{c === "standard" ? deliveryEta(t, locale, c, form.province) : (o.type as any)?.description}</span></span>
                      <span className={`pr ${o.amount === 0 || perkPromo ? "free" : ""}`}>
                        {o.amount === 0 ? t("free") : perkPromo ? <><s className="old">{formatAmount(o.amount ?? 0)}</s> {t("s5abc46")}</> : fmt(o.amount ?? 0)}
                      </span>
                      <span className="mark" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>

              <div className="panelbox" role="radiogroup" aria-label={t("s8f31e7")}>
                <h3>{t("s8f31e7")}</h3>
                {payments.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.id === payId} className={`payopt ${p.id === payId ? "on" : ""}`} onClick={() => setPayId(p.id)} data-testid={`pay-${p.key}`}>
                    <span className={`ic ${p.key === "whatsapp" ? "wa" : ""}`}><Icon name={p.icon} /></span>
                    <span className="t">
                      <b>{p.title}</b><span>{p.desc}</span>
                      {"logos" in p && p.logos && (
                        <span className="plogos">
                          {p.logos.map((l) => (
                            <span key={l}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- شعار دفع صغير ثابت */}
                              <img src={`/img/pay/${l}`} alt="" />
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="mark" aria-hidden="true" />
                  </button>
                ))}
                <div className="secure"><Icon name="lock" size={14} /> {t("s449d2f")}</div>
                <div className="after">
                  <div><Icon name="whatsapp" size={16} />{t("saefc28")}</div>
                  <div><Icon name="scissors" size={16} />{t("sd6d665")}</div>
                  <div><Icon name="truck" size={16} />{t("s050314")}</div>
                </div>
              </div>
            </>
          )}
        </div>
        {summary}
      </div>

      <div className="costicky">
        <div className="tot"><small>{shipping === null ? t("totalBeforeShipping") : t("sf4b22c")}</small><b>{fmt(total)}</b></div>
        {step === "address" ? (
          <button type="button" className="btn" onClick={() => onSaveAddress()} disabled={busy === "address"}>{t("s42f5cd")} <Icon name="arrowL" size={15} /></button>
        ) : (
          <button type="button" className="btn" onClick={onPlace} disabled={placing || busy === "ship" || !methodValid}>{placing ? t("confirming") : ctaLabel}</button>
        )}
      </div>
    </div>
  )
}
