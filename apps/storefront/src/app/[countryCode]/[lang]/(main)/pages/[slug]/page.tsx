import { readPage } from "@lib/pages/content"
import { renderMarkdown } from "@lib/pages/markdown"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getT } from "@/i18n/t"
import { langPrefix } from "@/i18n/config"
import { getStoreConfig } from "@/i18n/store-config"
import { langAlternates, ogLocale } from "@lib/seo/alternates"

type Props = { params: Promise<{ countryCode: string; slug: string; lang: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, countryCode, lang } = await props.params
  const page = readPage(slug, lang)
  if (!page) notFound()
  return { title: page.title, alternates: await langAlternates(countryCode, lang, `/pages/${slug}`), openGraph: { ...(await ogLocale(lang)) } }
}

/** H12: صفحات السياسات والمعلومات (كانت 404) — مطلوبة قانونياً ولبوابات الدفع */
export default async function StorePage(props: Props) {
  const sc = await getStoreConfig()
  const t = await getT("common")
  const { slug, countryCode, lang } = await props.params
  const page = readPage(slug, lang)
  if (!page) notFound()
  const base = `/${countryCode}${langPrefix(lang)}`
  return (
    <div className="container" style={{ maxWidth: 760, paddingBlock: 32 }}>
      <article className="prose-store" data-testid={`page-${slug}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body, base) }} />
      {(sc.legal.cr || sc.legal.vat) && (
        <p className="muted" data-testid="page-legal" style={{ marginTop: 24, fontSize: 13 }}>
          {sc.name}
          {sc.legal.cr && <> {t("s570afa")} <bdi>{sc.legal.cr}</bdi></>}
          {sc.legal.vat && <> {t("sa999fe")} <bdi>{sc.legal.vat}</bdi></>}
        </p>
      )}
    </div>
  )
}
