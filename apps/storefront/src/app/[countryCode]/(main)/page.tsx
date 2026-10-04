import { Metadata } from "next"
import { jsonLdScript, localBusiness, siteGraph } from "@lib/seo/jsonld"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import Decor from "@modules/common/components/decor"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { storeConfig } from "../../../store.config"

export const metadata: Metadata = {
  title: `${storeConfig.name} — ${storeConfig.tagline}`,
  description: storeConfig.description,
}


export default async function Home(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)
  const { collections } = await listCollections({ fields: "id, handle, title" })
  if (!collections || !region) return null
  // ترتيب المجموعات من store.json → home.collectionsOrder (غير المذكورة في الآخر)
  const order = storeConfig.home.collectionsOrder ?? []
  const rank = (h?: string | null) => (order.indexOf(h ?? "") < 0 ? 99 : order.indexOf(h ?? ""))
  const ordered = [...collections].sort((a, b) => rank(a.handle) - rank(b.handle))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(siteGraph(countryCode))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusiness(countryCode))} />
      <Hero />
      <Decor className="wrap" />
      <div className="pb-8">
        <ul className="flex flex-col">
          <FeaturedProducts collections={ordered} region={region} />
        </ul>
      </div>
    </>
  )
}
