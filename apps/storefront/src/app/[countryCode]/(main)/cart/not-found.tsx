import { g } from "@lib/voice"
import NotFoundView from "@modules/common/components/not-found-view"
import { Metadata } from "next"

export const metadata: Metadata = { title: "السلة غير موجودة", robots: { index: false } }

/** M23: 404 عربية بتصميم المتجر */
export default function NotFound() {
  return <NotFoundView title="السلة غير موجودة" hint={g("انتهت صلاحية السلة أو أُكمل الطلب. ابدئي سلة جديدة من المتجر:", "انتهت صلاحية السلة أو أُكمل الطلب. ابدأ سلة جديدة من المتجر:")} />
}
