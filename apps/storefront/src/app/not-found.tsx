import NotFoundView from "@modules/common/components/not-found-view"
import { Metadata } from "next"
import { getT, useT } from "@/i18n/t"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("common")
  return { title: t("sbb8423"), robots: { index: false } }
}

/** M23: 404 عربية بتصميم المتجر */
export default function NotFound() {
  return <NotFoundView />
}
