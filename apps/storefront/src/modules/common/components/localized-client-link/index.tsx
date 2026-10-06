"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"
import { langPrefix } from "@/i18n/config"

/**
 * Use this component to create a Next.js `<Link />` that persists the current country code in the url,
 * without having to explicitly pass it as a prop.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: any
}) => {
  const { countryCode, lang } = useParams()

  // العربية بلا بادئة (/om/…)، الإنجليزية /om/en/…
  return (
    <Link href={`/${countryCode}${langPrefix(lang)}${href}`} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
