import NotFoundView from "@modules/common/components/not-found-view"
import { Metadata } from "next"
import { getT, useT } from "@/i18n/t"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("cart")
  return { title: t("s09e7fa"), robots: { index: false } }
}

/** M23: 404 بتصميم المتجر */
export default function NotFound() {
  const t = useT("cart")
  return <NotFoundView title={t("s09e7fa")} hint={t("s648245")} />
}
