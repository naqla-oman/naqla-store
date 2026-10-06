"use client"
import { useState } from "react"

export default function LoginPage() {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null)
    const f = new FormData(e.currentTarget)
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) })
    const b = await r.json().catch(() => ({}))
    if (r.ok) location.href = "/"; else { setErr(b.error ?? "تعذّر الدخول"); setBusy(false) }
  }
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1 style={{ margin: 0 }}>لوحة نقلة</h1>
        <p className="muted" style={{ margin: 0 }}>دخول المدير — كلمة المرور ورمز تطبيق المصادقة</p>
        <label>البريد<input name="email" type="email" dir="ltr" autoComplete="username" required /></label>
        <label>كلمة المرور<input name="password" type="password" dir="ltr" autoComplete="current-password" required /></label>
        <label>رمز المصادقة (6 أرقام)<input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} dir="ltr" autoComplete="one-time-code" required /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn" disabled={busy}>دخول</button>
      </form>
    </div>
  )
}
