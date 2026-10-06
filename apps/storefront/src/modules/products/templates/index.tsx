import React, { Suspense } from "react"
import { productAlt } from "@lib/seo/alt"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductDetails from "@modules/products/components/product-details"
import CompleteLook from "@modules/products/components/complete-look"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import TailoringSlot from "@modules/products/components/tailoring/slot"
import { variantPricing } from "@modules/products/lib/variants"
import ProductActionsWrapper from "./product-actions-wrapper"
import { useT } from "@/i18n/t"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({ product, region, images }) => {
  const t = useT("product")
  const TAG: Record<string, string> = { new: t("sc590a3"), bestsellers: t("se5a09c") }
  if (!product || !product.id) return notFound()

  const category = product.categories?.[0]
  const { price, old } = variantPricing(product)
  const pct = old ? Math.round((1 - price / old) * 100) : 0
  const tag = product.collection?.handle ? TAG[product.collection.handle] : null
  const badge = pct > 0 ? <span className="ptag red"><bdi dir="ltr">-{pct}%</bdi></span> : tag ? <span className="ptag">{tag}</span> : null

  return (
    <div className="wrap" data-testid="product-container">
      <nav className="crumbs" aria-label={t("s1e22a1")}>
        <LocalizedClientLink href="/">{t("s3aa857")}</LocalizedClientLink>
        <Icon name="chevL" size={12} />
        {category && (
          <>
            <LocalizedClientLink href={`/categories/${category.handle}`}>{category.name}</LocalizedClientLink>
            <Icon name="chevL" size={12} />
          </>
        )}
        <b aria-current="page">{product.title}</b>
      </nav>

      <div className="pview">
        <ImageGallery images={images} title={product.title} alt={productAlt(product)} badge={badge} />
        <div className="pinfo">
          <ProductInfo product={product} />
          <Suspense fallback={<ProductActions disabled product={product} region={region} />}>
            <ProductActionsWrapper id={product.id} region={region} />
          </Suspense>
          <Suspense fallback={null}>
            <TailoringSlot product={product} region={region} />
          </Suspense>
          <ProductDetails product={product} />
        </div>
      </div>

      <Suspense fallback={null}>
        <CompleteLook product={product} region={region} />
      </Suspense>
      <Suspense fallback={null}>
        <RelatedProducts product={product} region={region} />
      </Suspense>
    </div>
  )
}

export default ProductTemplate
