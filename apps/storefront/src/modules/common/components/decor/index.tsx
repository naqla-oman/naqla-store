import { storeConfig } from "../../../../store.config"

/** زخرفة فاصلة من store.json → decor (مثل موج «بحر مسقط»). لا شيء إن لم تُعرَّف */
export default function Decor({ className = "" }: { className?: string }) {
  const d = storeConfig.decor
  if (!d || d.type !== "wave") return null
  return (
    <div className={`decor-wave ${className}`} aria-hidden="true" style={{ color: d.color }}>
      <svg viewBox="0 0 1200 24" preserveAspectRatio="none" width="100%" height="18">
        <path d="M0 12 Q 50 0 100 12 T 200 12 T 300 12 T 400 12 T 500 12 T 600 12 T 700 12 T 800 12 T 900 12 T 1000 12 T 1100 12 T 1200 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
