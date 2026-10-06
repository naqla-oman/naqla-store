"use client"

import { TrackingConfig } from "@lib/data/tracking"
import { flushTracking } from "@lib/tracking/events"
import { g } from "@lib/voice"
import Icon from "@modules/common/components/icon"
import { useCallback, useEffect, useState } from "react"
import { useT } from "@/i18n/t"

type Consent = { analytics: boolean; ads: boolean }
type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: any; _fbq?: any; snaptr?: any; ttq?: any; clarity?: any }

const COOKIE = "_consent"
const readConsent = (): Consent | null => {
  const m = document.cookie.match(/(?:^|; )_consent=([^;]*)/)
  if (!m) return null
  const v = decodeURIComponent(m[1])
  return { analytics: v.includes("analytics"), ads: v.includes("ads") }
}
const writeConsent = (c: Consent) => {
  const v = [c.analytics && "analytics", c.ads && "ads"].filter(Boolean).join(",") || "none"
  document.cookie = `${COOKIE}=${encodeURIComponent(v)}; path=/; max-age=${180 * 86400}; samesite=lax`
}
const addScript = (id: string, src: string) => {
  if (document.getElementById(id)) return
  const s = document.createElement("script")
  s.id = id; s.async = true; s.src = src
  document.head.appendChild(s)
}

/* ===== المنصات (مقتطفات رسمية مختصرة: طابور ثم تحميل المكتبة) ===== */
function initGoogle(id: string) {
  const w = window as W
  if (w.gtag) return
  w.dataLayer = w.dataLayer || []
  w.gtag = function () { (w.dataLayer as unknown[]).push(arguments) } // eslint-disable-line prefer-rest-params
  // Consent Mode v2: كل شيء مرفوض افتراضياً حتى قرار الزائر
  w.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", wait_for_update: 500 })
  w.gtag("js", new Date())
  w.gtag("config", id)
  addScript("gtag-js", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`)
}
function initMeta(id: string) {
  const w = window as W
  if (w.fbq) return
  const n: any = (w.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }) // eslint-disable-line prefer-rest-params
  if (!w._fbq) w._fbq = n
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = []
  addScript("meta-pixel", "https://connect.facebook.net/en_US/fbevents.js")
  w.fbq("init", id)
  w.fbq("track", "PageView")
}
function initSnap(id: string) {
  const w = window as W
  if (w.snaptr) return
  const a: any = (w.snaptr = function () { a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments) }) // eslint-disable-line prefer-rest-params
  a.queue = []
  addScript("snap-pixel", "https://sc-static.net/scevent.min.js")
  w.snaptr("init", id, {})
  w.snaptr("track", "PAGE_VIEW")
}
function initTikTok(id: string) {
  const w = window as W
  if (w.ttq) return
  const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"]
  const ttq: any = (w.ttq = [])
  ttq.methods = methods
  ttq.setAndDefer = (t: any, e: string) => { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }
  methods.forEach((m) => ttq.setAndDefer(ttq, m))
  addScript("tiktok-pixel", `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`)
  ttq.page()
}
function initClarity(id: string) {
  const w = window as W
  if (w.clarity) return
  w.clarity = function () { (w.clarity.q = w.clarity.q || []).push(arguments) } // eslint-disable-line prefer-rest-params
  addScript("clarity", `https://www.clarity.ms/tag/${encodeURIComponent(id)}`)
}

function apply(cfg: TrackingConfig, c: Consent) {
  const w = window as W
  if (cfg.ga4_measurement_id && w.gtag) {
    w.gtag("consent", "update", {
      analytics_storage: c.analytics ? "granted" : "denied",
      ad_storage: c.ads ? "granted" : "denied",
      ad_user_data: c.ads ? "granted" : "denied",
      ad_personalization: c.ads ? "granted" : "denied",
    })
  }
  if (c.ads) {
    if (cfg.meta_pixel_id) initMeta(cfg.meta_pixel_id)
    if (cfg.snap_pixel_id) initSnap(cfg.snap_pixel_id)
    if (cfg.tiktok_pixel_id) initTikTok(cfg.tiktok_pixel_id)
  }
  if (c.analytics && cfg.clarity_project_id) initClarity(cfg.clarity_project_id)
}

/** البكسلات + شريط الموافقة. لا شيء يُحمَّل لمنصة بلا معرّف، ولا بكسل إعلاني بلا موافقة */
export default function Tracking({ config }: { config: TrackingConfig | null }) {
  const t = useT("tracking")
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [choice, setChoice] = useState<Consent>({ analytics: true, ads: true })
  const any = !!config && Object.values(config).some(Boolean)

  useEffect(() => {
    if (!config || !any) return
    if (config.ga4_measurement_id) initGoogle(config.ga4_measurement_id)
    const c = readConsent()
    if (c) apply(config, c)
    else setOpen(true)
    // المنصات المتاحة الآن (Google دائماً بوضع الموافقة، والإعلانية إن وُجدت موافقة) جاهزة لاستقبال الطابور
    flushTracking()
    const reopen = () => { setCustom(true); setChoice(readConsent() ?? { analytics: false, ads: false }); setOpen(true) }
    window.addEventListener("open-consent", reopen)
    return () => window.removeEventListener("open-consent", reopen)
  }, [config, any])

  const save = useCallback((c: Consent) => {
    writeConsent(c)
    if (config) apply(config, c)
    setOpen(false)
  }, [config])

  if (!open) return null
  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label={t("s918b7c")} data-testid="consent">
      <div className="consent-in">
        <p>
          <Icon name="shield" size={16} />{" "}
          {t("se67f41")}
        </p>
        {custom && (
          <div className="consent-opts">
            <label><input type="checkbox" checked disabled /> {t("sbd5c9b")}</label>
            <label><input type="checkbox" checked={choice.analytics} onChange={(e) => setChoice({ ...choice, analytics: e.target.checked })} /> {t("s06c945")}</label>
            <label><input type="checkbox" checked={choice.ads} onChange={(e) => setChoice({ ...choice, ads: e.target.checked })} /> {t("s45b745")}</label>
          </div>
        )}
        <div className="consent-acts">
          {custom ? (
            <button type="button" className="btn sm" onClick={() => save(choice)} data-testid="consent-save">{t("s54b103")}</button>
          ) : (
            <button type="button" className="btn sm" onClick={() => save({ analytics: true, ads: true })} data-testid="consent-accept">{t("s2377e7")}</button>
          )}
          <button type="button" className="btn sm ghost" onClick={() => save({ analytics: false, ads: false })} data-testid="consent-reject">{t("se5e996")}</button>
          {!custom && <button type="button" className="linkbtn" onClick={() => { setCustom(true); setChoice({ analytics: true, ads: true }) }}>{t("se0fc0d")}</button>}
        </div>
      </div>
    </div>
  )
}
