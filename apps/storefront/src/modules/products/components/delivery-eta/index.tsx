"use client"

import Icon from "@modules/common/components/icon"
import { useEffect, useState } from "react"
import { storeConfig } from "../../../../store.config"
import { g } from "@lib/voice"

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const { timezone, cityLabel, othersLabel } = storeConfig.product.delivery

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

function compute() {
  const { day, h, m } = storeNow()
  const left = storeConfig.cutoffHour * 60 - (h * 60 + m)
  if (left > 0) {
    return {
      title: `${g("اطلبي", "اطلب")} خلال ${Math.floor(left / 60)} س و ${left % 60} د`,
      sub: `تصلك غداً ${DAYS[(day + 1) % 7]} ${cityLabel} · ${othersLabel}`,
    }
  }
  return { title: "تصلك بعد غد", sub: `${DAYS[(day + 2) % 7]} ${cityLabel} · ${othersLabel}` }
}

export default function DeliveryEta() {
  const [eta, setEta] = useState<ReturnType<typeof compute> | null>(null)

  useEffect(() => {
    setEta(compute())
    const t = setInterval(() => setEta(compute()), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="eta" aria-live="polite">
      <Icon name="truck" size={22} />
      <div>
        <b>{eta?.title ?? "توصيل لكل محافظات السلطنة"}</b>
        <span>{eta?.sub ?? "خلال ٢٤–٤٨ ساعة"}</span>
      </div>
    </div>
  )
}
