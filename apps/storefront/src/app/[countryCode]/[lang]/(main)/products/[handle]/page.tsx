import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { findRedirect } from "@lib/data/seo"
import { breadcrumbs, jsonLdScript, offerExtras } from "@lib/seo/jsonld"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"
import { PRODUCT_FIELDS } from "@modules/products/lib/fields"
import { variantPricing, availableQty } from "@modules/products/lib/variants"
import { getBaseURL } from "@lib/util/env"
import { storeConfig } from "@/store.config"
import { getFreeShippingOver } from "@lib/data/shipping-threshold"
import { langPrefix } from "@/i18n/config"

type Props = {
  params: Promise<{ countryCode: string; handle: string; lang: string }>
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
    // رابط قديم بعد تغيير الرابط ← 301 للجديد
    const to = await findRedirect(`/products/${handle}`)
    if (to) permanentRedirect(`/${params.countryCode}${langPrefix(params.lang)}${to}`)
    notFound()
  }
  // منخفضة: منتج الخدمة («تفصيل خاص») يُطلب من صفحة العباءة فقط — لا صفحة مستقلة ولا فهرسة
  if ((product.metadata as any)?.service) notFound()

  const meta = (product.metadata ?? {}) as Record<string, any>
  const description = (meta.seo_description || product.description || product.title).slice(0, 160)
  return {
    title: meta.seo_title || product.title,
    description,
    alternates: { canonical: `/${params.countryCode}${langPrefix(params.lang)}/products/${handle}` },
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
    const to = await findRedirect(`/products/${params.handle}`)
    if (to) permanentRedirect(`/${params.countryCode}${langPrefix(params.lang)}${to}`)
    notFound()
  }
  // منخفضة: منتج الخدمة لا صفحة مستقلة له (يُطلب من صفحة القطعة) — 404 حقيقي من دالة الصفحة
  if ((pricedProduct.metadata as any)?.service) notFound()

  const images = getImagesForVariant(pricedProduct, selectedVariantId)
  const { price, currency } = variantPricing(pricedProduct)
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
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${getBaseURL()}/#org` },
      ...offerExtras(price, await getFreeShippingOver()),
    },
    // لا aggregateRating: التقييمات حالياً بيانات مزروعة لا تقييمات حقيقية (إرشادات Google)
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={jsonLdScript(
        breadcrumbs([
          { name: "الرئيسية", path: `/${params.countryCode}${langPrefix(params.lang)}` },
          ...(pricedProduct.categories?.[0]
            ? [{ name: pricedProduct.categories[0].name, path: `/${params.countryCode}${langPrefix(params.lang)}/categories/${pricedProduct.categories[0].handle}` }]
            : []),
          { name: pricedProduct.title, path: `/${params.countryCode}${langPrefix(params.lang)}/products/${pricedProduct.handle}` },
        ])
      )}
    />
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={params.countryCode}
      images={images}
    />
    </>
  )
}
