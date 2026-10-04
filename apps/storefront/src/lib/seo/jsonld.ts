import { getBaseURL } from "@lib/util/env"
import { clientAsset, storeConfig as c } from "../../store.config"

/** بيانات منظّمة (schema.org) من إعدادات المتجر فقط — بلا أي اسم عميل في الكود */

const abs = (p: string) => (/^https?:\/\//.test(p) ? p : `${getBaseURL()}${p.startsWith("/") ? "" : "/"}${p}`)
const COUNTRY = c.seo.country.toUpperCase()

export const jsonLdScript = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") })

/** Organization + WebSite (مع بحث يعمل: /store?q=) */
export function siteGraph(countryCode: string) {
  const site = `${getBaseURL()}/${countryCode}`
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${getBaseURL()}/#org`,
        name: c.name,
        alternateName: c.nameEn,
        url: site,
        logo: abs(clientAsset("icons/icon-512.png")),
        sameAs: Object.values(c.social ?? {}).filter((u) => u && !/\/\/[^/]+\/?$/.test(u)),
        contactPoint: { "@type": "ContactPoint", telephone: c.contact.phone, email: c.contact.email, contactType: "customer service", areaServed: COUNTRY, availableLanguage: ["ar"] },
      },
      {
        "@type": "WebSite",
        "@id": `${getBaseURL()}/#website`,
        url: site,
        name: c.name,
        inLanguage: c.locale,
        publisher: { "@id": `${getBaseURL()}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${site}/store?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  }
}

/** المحل الفعلي (للاستلام والزيارة) */
export function localBusiness(countryCode: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${getBaseURL()}/#store`,
    name: c.seo.location.name || c.name,
    url: `${getBaseURL()}/${countryCode}`,
    image: abs(clientAsset("og.jpg")),
    telephone: c.contact.phone,
    email: c.contact.email,
    address: { "@type": "PostalAddress", streetAddress: c.seo.location.address, addressLocality: c.seo.location.city, addressCountry: COUNTRY },
    parentOrganization: { "@id": `${getBaseURL()}/#org` },
  }
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  }
}

/** تفاصيل التوصيل لكل طريقة من store.json (مجاني فوق الحد إن وُجد) + سياسة الإرجاع */
export function offerExtras(price: number) {
  const currency = c.currency.toUpperCase()
  const shippingDetails = c.seo.shipping
    .filter((sh) => sh.code !== "pickup")
    .map((sh) => ({
      "@type": "OfferShippingDetails",
      shippingLabel: sh.name,
      shippingRate: { "@type": "MonetaryAmount", value: (sh.free_over && price >= sh.free_over ? 0 : sh.amount).toFixed(3), currency },
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: COUNTRY,
        ...(sh.provinces?.length ? { addressRegion: sh.provinces.map((p) => p.toUpperCase()) } : {}),
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: sh.code === "express" ? 0 : 1, maxValue: sh.code === "express" ? 0 : 2, unitCode: "DAY" },
      },
    }))
  const hasMerchantReturnPolicy = c.seo.returnDays
    ? {
        "@type": "MerchantReturnPolicy",
        applicableCountry: COUNTRY,
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: c.seo.returnDays,
        returnMethod: "https://schema.org/ReturnInStore",
        returnFees: "https://schema.org/FreeReturn",
      }
    : { "@type": "MerchantReturnPolicy", applicableCountry: COUNTRY, returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" }
  return { shippingDetails, hasMerchantReturnPolicy }
}
