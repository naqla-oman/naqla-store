import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"
import { PRODUCT_FIELDS } from "@modules/products/lib/fields"
import { variantPricing, availableQty } from "@modules/products/lib/variants"
import { getBaseURL } from "@lib/util/env"
import { storeConfig } from "../../../../../store.config"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })

      return {
        country,
        products: response.products,
      }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string
): HttpTypes.StoreProductImage[] {
  const all = product.images ?? []
  const variant = selectedVariantId ? product.variants?.find((v) => v.id === selectedVariantId) : undefined
  if (!variant?.images?.length) {
    return all
  }

  const imageIdsMap = new Map(variant.images.map((i) => [i.id, true]))
  return all.filter((i) => imageIdsMap.has(i.id))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  const description = (product.description || product.title).slice(0, 160)
  return {
    title: product.title,
    description,
    alternates: { canonical: `/${params.countryCode}/products/${handle}` },
    openGraph: {
      title: `${product.title} | ${storeConfig.name}`,
      description,
      locale: "ar_OM",
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)
  const searchParams = await props.searchParams

  const selectedVariantId = searchParams.v_id

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle, fields: PRODUCT_FIELDS },
  }).then(({ response }) => response.products[0])

  if (!pricedProduct) {
    notFound()
  }

  const images = getImagesForVariant(pricedProduct, selectedVariantId)
  const { price, currency } = variantPricing(pricedProduct)
  const meta = (pricedProduct.metadata || {}) as Record<string, any>
  const inStock = (pricedProduct.variants ?? []).some((v) => availableQty(v) > 0)
  const url = `${getBaseURL()}/${params.countryCode}/products/${pricedProduct.handle}`
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pricedProduct.title,
    description: pricedProduct.description ?? undefined,
    image: (pricedProduct.images ?? []).map((i) => (i.url.startsWith("http") ? i.url : `${getBaseURL()}${i.url}`)),
    sku: pricedProduct.variants?.[0]?.sku ?? undefined,
    brand: { "@type": "Brand", name: storeConfig.name },
    category: pricedProduct.categories?.[0]?.name,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: currency.toUpperCase(),
      price: price.toFixed(3),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(meta.rating && meta.reviews
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: meta.rating, reviewCount: meta.reviews } }
      : {}),
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={params.countryCode}
      images={images}
    />
    </>
  )
}
