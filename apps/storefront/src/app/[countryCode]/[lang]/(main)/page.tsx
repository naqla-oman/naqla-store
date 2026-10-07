import { Metadata } from "next"
import { jsonLdScript, localBusiness, siteGraph } from "@lib/seo/jsonld"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import Decor from "@modules/common/components/decor"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { getStoreConfig } from "@/i18n/store-config"
import { langAlternates, ogLocale } from "@lib/seo/alternates"

export async function generateMetadata(props: { params: Promise<{ countryCode: string; lang: string }> }): Promise<Metadata> {
  const sc = await getStoreConfig()
  const { countryCode, lang } = await props.params
  return {
    title: `${sc.name} — ${sc.tagline}`,
    description: sc.description,
    alternates: await langAlternates(countryCode, lang, ""),
    openGraph: { title: `${sc.name} — ${sc.tagline}`, description: sc.description, ...(await ogLocale(lang)) },
  }
}


export default async function Home(props: { params: Promise<{ countryCode: string; lang: string }> }) {
  const { countryCode, lang } = await props.params
  const sc = await getStoreConfig()
  const region = await getRegion(countryCode)
  const { collections } = await listCollections({ fields: "id, handle, title" })
  if (!collections || !region) return null
  // ترتيب المجموعات من store.json → home.collectionsOrder (غير المذكورة في الآخر)
  const order = sc.home.collectionsOrder ?? []
  const rank = (h?: string | null) => (order.indexOf(h ?? "") < 0 ? 99 : order.indexOf(h ?? ""))
  const ordered = [...collections].sort((a, b) => rank(a.handle) - rank(b.handle))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(siteGraph(countryCode, lang, sc))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusiness(countryCode, lang, sc))} />
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
