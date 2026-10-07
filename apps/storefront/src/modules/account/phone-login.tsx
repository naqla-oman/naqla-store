"use client"

import { track } from "@lib/tracking/events"
import { completeProfile, requestOtp, verifyOtp } from "@lib/data/account"
import { localWishlist } from "@lib/context/wishlist"
import Icon from "@modules/common/components/icon"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useRef, useState } from "react"
import { storeConfig } from "../../store.config"
import { g } from "@lib/voice"
import { useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

const { phone: P } = storeConfig.checkout
const phoneRe = new RegExp(P.pattern)
const RESEND = 60

/** الدخول برمز واتساب: الرقم ← الرمز (6 أرقام) ← الاسم (أول مرة فقط) */
export default function PhoneLogin() {
  const sc = useStoreConfig()
  const t = useT("account")
  const router = useRouter()
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone")
  const [phone, setPhone] = useState("")
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""))
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(0)
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (!phoneRe.test(phone)) { setError(t("se31171")); return }
    setBusy(true)
    const r = await requestOtp(phone)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setDigits(Array(6).fill(""))
    setStep("otp")
    setLeft(RESEND)
    setTimeout(() => boxes.current[0]?.focus(), 50)
  }

  const verify = async (code: string) => {
    setBusy(true)
    setError(null)
    const r = await verifyOtp(phone, code, localWishlist())
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      setDigits(Array(6).fill(""))
      boxes.current[0]?.focus()
      return
    }
    if (r.data?.needsProfile) { setStep("profile"); return }
    router.refresh()
  }

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "")
    if (clean.length > 1) {
      // لصق الرمز كاملاً
      const next = clean.slice(0, 6).split("")
      const filled = [...next, ...Array(6 - next.length).fill("")]
      setDigits(filled)
      if (next.length === 6) verify(next.join(""))
      else boxes.current[next.length]?.focus()
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) boxes.current[i + 1]?.focus()
    if (next.every(Boolean)) verify(next.join(""))
  }

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await completeProfile({ firstName: first, lastName: last, email }, localWishlist())
    if (r.ok) track("sign_up", { method: "whatsapp_otp" })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    router.refresh()
  }

  return (
    <div className="wrap">
      <div className="loginwrap">
        <div className="panelbox">
          <div className="loginbadge"><Icon name="whatsapp" size={28} /></div>

          {step === "phone" && (
            <form onSubmit={send} noValidate>
              <h1>{t("welcomeTo", { store: sc.shortName })}</h1>
              <p className="lead">{t("sd39726")} — {t("otpNote")}</p>
              <div className={`field ${error ? "err" : ""}`}>
                <label htmlFor="lPhone">{t("s0947ad")}</label>
                <div className="phone">
                  <input id="lPhone" type="tel" inputMode="numeric" maxLength={8} value={phone} autoFocus dir="ltr"
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder={P.placeholder} autoComplete="tel-national" aria-invalid={!!error} aria-describedby="lErr" />
                  <span className="pre">{P.prefix}</span>
                </div>
                <span className="ferr" id="lErr">{error}</span>
              </div>
              <button type="submit" className="btn block lg" style={{ marginTop: 16 }} disabled={busy} data-testid="send-otp">
                <Icon name="whatsapp" size={18} /> {busy ? t("s172044") : t("sa3838d")}
              </button>
              <div className="perkline">
                {sc.features.loyalty && <div><Icon name="sparkle" size={15} /> {t("pointsPerRial", { n: sc.loyalty.pointsPerUnit })}</div>}
                <div><Icon name="box" size={15} /> {t("sdd473a")}</div>
                <div><Icon name="heart" size={15} /> {t("s1892f8")}</div>
              </div>
            </form>
          )}

          {step === "otp" && (
            <div>
              <h1>{t("se621b3")}</h1>
              <p className="lead">
                {t("sd1510d")}{" "}
                <span className="sentto"><bdi dir="ltr">{P.prefix} {phone}</bdi></span>{" "}
                <button type="button" className="linkbtn" onClick={() => { setStep("phone"); setError(null) }}>{t("sd01396")}</button>
              </p>
              <div className={`otp ${error ? "err" : ""}`} role="group" aria-label={t("scdce6b")}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { boxes.current[i] = el }}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={i === 0 ? 6 : 1}
                    aria-label={t("digitN", { n: i + 1 })}
                    disabled={busy}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus() }}
                    data-testid={`otp-${i}`}
                  />
                ))}
              </div>
              {error && <div className="ferr-inline" role="alert" style={{ textAlign: "center" }}>{error}</div>}
              {busy && <div className="okmsg" style={{ textAlign: "center" }}>{t("sc3de69")}</div>}
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button type="button" className="linkbtn" disabled={left > 0 || busy} onClick={() => send()}>
                  {left > 0 ? t("resendIn", { s: left }) : t("s9d645b")}
                </button>
              </div>
            </div>
          )}

          {step === "profile" && (
            <form onSubmit={saveProfile} noValidate>
              <h1>{t("sebe643")}</h1>
              <p className="lead">{t("s83950b")}</p>
              <div className="profilerow">
                <div className="field"><label htmlFor="pFirst">{t("s2e8b17")}</label><input id="pFirst" value={first} onChange={(e) => setFirst(e.target.value)} autoFocus autoComplete="given-name" placeholder={t("s0323c8")} /></div>
                <div className="field"><label htmlFor="pLast">{t("s6183fe")}</label><input id="pLast" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" placeholder={t("sfabcbc")} /></div>
              </div>
              <div className="field">
                <label htmlFor="pEmail">{t("s2436aa")} <span style={{ fontWeight: 400 }}>{t("s836573")}</span></label>
                <input id="pEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" style={{ textAlign: "start" }} placeholder="name@example.com" autoComplete="email" />
              </div>
              {error && <div className="alert" role="alert"><Icon name="x" size={15} /> {error}</div>}
              <button type="submit" className="btn block lg" style={{ marginTop: 16 }} disabled={busy || !first.trim()} data-testid="save-profile">
                {busy ? t("sa1b550") : t("s6e10ac")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
