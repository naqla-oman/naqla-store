import Icon from "@modules/common/components/icon"
import { useT } from "@/i18n/t"

/** شريط الخطوات: السلة ← العنوان ← الدفع (current يبدأ من 0) */
export default function Steps({ current }: { current: 0 | 1 | 2 }) {
  const t = useT("checkout")
  const STEPS = [t("s0c93af"), t("s6dc658"), t("s4ee631")]
  return (
    <nav className="steps" aria-label={t("scce193")}>
      {STEPS.map((s, i) => (
        <span key={s} style={{ display: "contents" }}>
          {i > 0 && <span className="sep" aria-hidden="true" />}
          {i < current ? (
            <b><i><Icon name="check" size={12} /></i> {s}</b>
          ) : i === current ? (
            <b className="cur" aria-current="step"><i>{i + 1}</i> {s}</b>
          ) : (
            <span className="todo"><i>{i + 1}</i> {s}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
