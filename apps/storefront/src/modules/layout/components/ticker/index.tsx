import { storeConfig } from "../../../../store.config"
import { getFreeShippingOver } from "@lib/data/shipping-threshold"
import { formatAmount } from "@lib/util/money"

/** الشريط المتحرك أعلى الصفحة — نفس أسلوب الديمو */
export default async function Ticker() {
  // قيم لها مصدر واحد تُملأ عند الرسم: {free_over} من Medusa (تبويب التوصيل) و{return_days} من الإعدادات؛ العنصر بلا قيمة يُخفى
  const free = await getFreeShippingOver()
  const fill = (t: string) =>
    (t.includes("{free_over}") && free == null) || (t.includes("{return_days}") && !storeConfig.seo.returnDays)
      ? null
      : t.replace("{free_over}", Number.isInteger(free) ? String(free) : formatAmount(free ?? 0)).replace("{return_days}", String(storeConfig.seo.returnDays))
  const base = storeConfig.ticker.map(fill).filter((x): x is string => !!x)
  const items = [...base, ...base, ...base]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="tk">
        {items.map((t, i) => (
          <span key={i}>
            {t}
            <i />
          </span>
        ))}
      </div>
    </div>
  )
}
