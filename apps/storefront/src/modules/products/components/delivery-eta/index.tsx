"use client"

import Icon from "@modules/common/components/icon"
import { useEffect, useState } from "react"
import { storeConfig } from "../../../../store.config"
import { useLocale } from "next-intl"
import { useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"

const { timezone } = storeConfig.product.delivery

/** الوقت الحالي بتوقيت المتجر (مسقط) بغض النظر عن منطقة جهاز الزبونة */
function storeNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))
  return { day: wd, h: Number(get("hour")), m: Number(get("minute")) }
}

/** اسم اليوم حسب اللغة (الفهرس 0 = الأحد) */
const dayName = (locale: string, idx: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { weekday: "long" }).format(new Date(2026, 0, 4 + ((idx % 7) + 7) % 7))
type T = (k: string, v?: Record<string, string | number>) => string
function compute(t: T, locale: string, { cityLabel, othersLabel }: { cityLabel: string; othersLabel: string }) {
  const { day, h, m } = storeNow()
  const left = storeConfig.cutoffHour * 60 - (h * 60 + m)
  if (left > 0) {
    return {
      title: t("withinHours", { h: Math.floor(left / 60), m: left % 60 }),
      sub: t("tomorrow", { day: dayName(locale, day + 1), city: cityLabel, others: othersLabel }),
    }
  }
  return { title: t("s9928e2"), sub: `${dayName(locale, day + 2)} ${cityLabel} · ${othersLabel}` }
}

export default function DeliveryEta() {
  const sc = useStoreConfig()
  const t = useT("product")
  const locale = useLocale()
  const [eta, setEta] = useState<ReturnType<typeof compute> | null>(null)

  useEffect(() => {
    setEta(compute(t, locale, sc.product.delivery))
    const timer = setInterval(() => setEta(compute(t, locale, sc.product.delivery)), 30_000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t وlocale ثابتان للصفحة
  }, [])

  return (
    <div className="eta" aria-live="polite">
      <Icon name="truck" size={22} />
      <div>
        <b>{eta?.title ?? t("sef2b91")}</b>
        <span>{eta?.sub ?? t("s94ba41")}</span>
      </div>
    </div>
  )
}
