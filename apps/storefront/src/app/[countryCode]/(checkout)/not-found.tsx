import NotFoundView from "@modules/common/components/not-found-view"
import { Metadata } from "next"

export const metadata: Metadata = { title: "الصفحة غير موجودة", robots: { index: false } }

/** M23: 404 عربية بتصميم المتجر */
export default function NotFound() {
  return <NotFoundView />
}
