import Image from "next/image"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Money from "@modules/common/components/money"
import { variantPricing } from "@modules/products/lib/variants"
import { getT } from "@/i18n/t"

/** «أكملي الإطلالة»: القطع المكمّلة المحددة في metadata.complements */
export default async function CompleteLook({ product, region }: { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion }) {
  const t = await getT("product")
  const handles = ((product.metadata as any)?.complements ?? []) as string[]
  if (!handles.length) return null

  const { response } = await listProducts({
    regionId: region.id,
    queryParams: { handle: handles, fields: "*variants.calculated_price,+metadata,*categories", limit: handles.length },
  })
  const items = handles.map((h) => response.products.find((p) => p.handle === h)).filter(Boolean) as HttpTypes.StoreProduct[]
  if (!items.length) return null

  const all = [product, ...items]
  const total = all.reduce((s, p) => s + variantPricing(p).price, 0)
  const cats = items.map((p) => p.categories?.[0]?.name).filter(Boolean)

  return (
    <section className="lookset" aria-labelledby="look-title">
      <div className="items">
        {all.map((p, i) => (
          <LocalizedClientLink key={p.id} href={`/products/${p.handle}`} className={`it ${i === 0 ? "cur" : ""}`} aria-current={i === 0 ? "page" : undefined}>
            {p.thumbnail && <Image src={p.thumbnail} alt={p.title} fill sizes="140px" />}
            <span>{p.title}</span>
          </LocalizedClientLink>
        ))}
      </div>
      <div className="ltxt">
        <div className="pcat">{t("sbb2297")}</div>
        <h3 id="look-title">{t("lookWith", { cats: cats.join(t("s977409")) })}</h3>
        <p className="muted">{t("lookNote")} — {t("s638fd9")}</p>
        <div className="tot">
          <span className="muted">{t("s042dc8")}</span>
          <Money amount={total} />
        </div>
      </div>
    </section>
  )
}
