import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import { storeConfig } from "../../../../store.config"

const cfg = storeConfig.product

/** المزايا + أقسام قابلة للطي: التفاصيل، دليل المقاسات، الشحن والإرجاع */
export default function ProductDetails({ product }: { product: HttpTypes.StoreProduct }) {
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
          <summary>التفاصيل والخامة <Icon name="chevD" size={18} /></summary>
          <div className="body">
            {product.description} {cfg.craftNote}
            {product.material && <p className="mt-2">الخامة: {product.material}</p>}
          </div>
        </details>
        {guide && (
          <details id="size-guide">
            <summary>دليل المقاسات <Icon name="chevD" size={18} /></summary>
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
          <summary>الشحن والإرجاع <Icon name="chevD" size={18} /></summary>
          <div className="body">{cfg.shippingReturns}</div>
        </details>
      </div>
    </>
  )
}
