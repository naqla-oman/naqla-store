import { Metadata } from "next"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { storeConfig } from "../../../store.config"

export const metadata: Metadata = {
  title: `${storeConfig.name} — ${storeConfig.tagline}`,
  description: storeConfig.description,
}

const ORDER = ["new", "bestsellers", "sale"]

export default async function Home(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)
  const { collections } = await listCollections({ fields: "id, handle, title" })
  if (!collections || !region) return null
  const ordered = [...collections].sort((a, b) => ORDER.indexOf(a.handle!) - ORDER.indexOf(b.handle!))

  return (
    <>
      <Hero />
      <div className="pb-8">
        <ul className="flex flex-col">
          <FeaturedProducts collections={ordered} region={region} />
        </ul>
      </div>
    </>
  )
}
