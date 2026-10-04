import type { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

/** robots.txt: كل المتجر قابل للفهرسة عدا السلة والدفع والحساب والطلبات (صفحات خاصة بالزبون) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/cart", "/*/checkout", "/*/account", "/*/order/", "/*/track", "/*?*v_id="],
      },
    ],
    sitemap: `${getBaseURL()}/sitemap.xml`,
    host: getBaseURL(),
  }
}
