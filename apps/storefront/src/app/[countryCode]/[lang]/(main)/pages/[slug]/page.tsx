import { readPage } from "@lib/pages/content"
import { renderMarkdown } from "@lib/pages/markdown"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { storeConfig } from "@/store.config"
import { getT } from "@/i18n/t"
import { langPrefix } from "@/i18n/config"

type Props = { params: Promise<{ countryCode: string; slug: string; lang: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, countryCode, lang } = await props.params
  const page = readPage(slug, lang)
  if (!page) notFound()
  return { title: page.title, alternates: { canonical: `/${countryCode}${langPrefix(lang)}/pages/${slug}` } }
}

/** H12: صفحات السياسات والمعلومات (كانت 404) — مطلوبة قانونياً ولبوابات الدفع */
export default async function StorePage(props: Props) {
  const t = await getT("common")
  const { slug, countryCode, lang } = await props.params
  const page = readPage(slug, lang)
  if (!page) notFound()
  const base = `/${countryCode}${langPrefix(lang)}`
  return (
    <div className="container" style={{ maxWidth: 760, paddingBlock: 32 }}>
      <article className="prose-store" data-testid={`page-${slug}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body, base) }} />
      {(storeConfig.legal.cr || storeConfig.legal.vat) && (
        <p className="muted" data-testid="page-legal" style={{ marginTop: 24, fontSize: 13 }}>
          {storeConfig.name}
          {storeConfig.legal.cr && <> {t("s570afa")} <bdi>{storeConfig.legal.cr}</bdi></>}
          {storeConfig.legal.vat && <> {t("sa999fe")} <bdi>{storeConfig.legal.vat}</bdi></>}
        </p>
      )}
    </div>
  )
}
