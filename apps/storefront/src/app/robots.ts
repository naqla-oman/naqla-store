import type { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

/** robots.txt: كل المتجر قابل للفهرسة عدا السلة والدفع والحساب والطلبات (صفحات خاصة بالزبون) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // روابط المتغيّرات (?v_id=) تبقى مسموحة: هي روابط الكتالوجات، وMerchant Center يرفض صفحة هبوط محجوبة؛
        // التكرار يعالجه الرابط الأساسي (canonical) في صفحة المنتج
        disallow: ["/*/cart", "/*/checkout", "/*/account", "/*/order/", "/*/track"],
      },
    ],
    // بلا Host: توجيه غير قياسي (Yandex فقط) ويقبل اسم النطاق دون بروتوكول
    sitemap: `${getBaseURL()}/sitemap.xml`,
  }
}
