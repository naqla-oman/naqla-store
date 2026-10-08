import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import { useT } from "@/i18n/t"
import { useStoreConfig } from "@/i18n/store-config"


/** المزايا + أقسام قابلة للطي: التفاصيل، دليل المقاسات، الشحن والإرجاع */
export default function ProductDetails({ product }: { product: HttpTypes.StoreProduct }) {
  const sc = useStoreConfig()
  const cfg = sc.product
  const t = useT("product")
  const category = product.categories?.[0]?.handle ?? ""
  const guide = cfg.sizeGuides[category]

  return (
    <>
      <div className="perks">
        {cfg.perks.map((p) => (
          <div key={p.text}><Icon name={p.icon} size={18} /> {p.text}</div>
        ))}
      </div>
      <div className="acc">
        <details open>
          <summary>{t("sb29cfa")} <Icon name="chevD" size={18} /></summary>
          <div className="body">
            {/* الوصف المستورد فقرات بأسطر (store:import) */}
            <span className="whitespace-pre-line">{product.description}</span> {cfg.craftNote}
            {product.material && <p className="mt-2">{t("material", { material: product.material })}</p>}
          </div>
        </details>
        {guide && (
          <details id="size-guide">
            <summary>{t("s7cde0a")} <Icon name="chevD" size={18} /></summary>
            <div className="body">
              <div className="tablewrap">
                <table>
                  <thead><tr>{guide.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                  <tbody>{guide.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className="num">{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          </details>
        )}
        <details>
          <summary>{t("sfc860f")} <Icon name="chevD" size={18} /></summary>
          <div className="body">{cfg.shippingReturns}</div>
        </details>
      </div>
    </>
  )
}
