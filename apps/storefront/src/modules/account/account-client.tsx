"use client"

import { redeemPoints, updateEmail, updateName } from "@lib/data/account"
import { signout } from "@lib/data/customer"
import Icon from "@modules/common/components/icon"
import CopyButton from "@modules/order/components/copy-button"
import { useParams, useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { storeConfig } from "../../store.config"

const { redeemPoints: NEED, redeemValue } = storeConfig.loyalty

/** استبدال النقاط بكود خصم */
export function RedeemBox({ available }: { available: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const can = available >= NEED

  const go = async () => {
    setBusy(true); setError(null)
    const r = await redeemPoints()
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setCode(r.data!.code)
    router.refresh()
  }

  return (
    <>
      <div className="redeem">
        <Icon name="sparkle" size={22} />
        <div>
          <b>استبدلي {NEED} نقطة بكود خصم {redeemValue} {storeConfig.currencyLabel}</b>
          <span>{can ? "متاح الآن — يُستخدم مرة واحدة على أي طلب" : `تبقّى ${NEED - available} نقطة متاحة`}</span>
        </div>
        <button type="button" className={`btn sm ${can ? "" : "ghost"}`} onClick={go} disabled={!can || busy} data-testid="redeem">
          {busy ? "…" : "استبدال"}
        </button>
      </div>
      {code && (
        <div className="codebox" data-testid="redeem-code">
          <code>{code}</code>
          <CopyButton text={code} />
        </div>
      )}
      {error && <div className="ferr-inline" role="alert">{error}</div>}
    </>
  )
}

/** الاسم والبريد — البريد المحجوز (phone.invalid) لا يُعرض */
export function ProfileForm({ first, last, email }: { first: string; last: string; email: string }) {
  const router = useRouter()
  const [f, setF] = useState(first)
  const [l, setL] = useState(last)
  const [e, setE] = useState(email)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true); setMsg(null)
    const r1 = await updateName(f, l)
    const r2 = e.trim() && e.trim() !== email ? await updateEmail(e.trim()) : { ok: true as const }
    setBusy(false)
    if (!r1.ok) return setMsg({ ok: false, t: r1.error })
    if (!r2.ok) return setMsg({ ok: false, t: (r2 as any).error })
    setMsg({ ok: true, t: "تم الحفظ" })
    router.refresh()
  }

  return (
    <form className="panelbox" onSubmit={save} noValidate>
      <h3>بياناتي</h3>
      <div className="profilerow">
        <div className="field"><label htmlFor="aFirst">الاسم</label><input id="aFirst" value={f} onChange={(x) => setF(x.target.value)} autoComplete="given-name" /></div>
        <div className="field"><label htmlFor="aLast">العائلة</label><input id="aLast" value={l} onChange={(x) => setL(x.target.value)} autoComplete="family-name" /></div>
      </div>
      <div className="field">
        <label htmlFor="aEmail">البريد الإلكتروني <span style={{ fontWeight: 400 }}>(اختياري)</span></label>
        <input id="aEmail" type="email" value={e} onChange={(x) => setE(x.target.value)} dir="ltr" style={{ textAlign: "start" }} placeholder="name@example.com" autoComplete="email" />
      </div>
      {msg && <div className={msg.ok ? "saved" : "ferr-inline"} role="status">{msg.t}</div>}
      <button type="submit" className="btn ghost block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
    </form>
  )
}

export function SignOutButton() {
  const { countryCode } = useParams() as { countryCode: string }
  return (
    <button type="button" className="rowlink" onClick={() => signout(countryCode)} data-testid="signout">
      <span className="ic"><Icon name="x" /></span>
      <div>تسجيل الخروج</div>
    </button>
  )
}
