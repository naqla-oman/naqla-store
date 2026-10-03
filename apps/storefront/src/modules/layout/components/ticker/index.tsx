import { storeConfig } from "../../../../store.config"

/** الشريط المتحرك أعلى الصفحة — نفس أسلوب الديمو */
export default function Ticker() {
  const items = [...storeConfig.ticker, ...storeConfig.ticker, ...storeConfig.ticker]
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
