import { readPage } from "@lib/pages/content"
import { renderMarkdown } from "@lib/pages/markdown"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ countryCode: string; slug: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, countryCode } = await props.params
  const page = readPage(slug)
  if (!page) notFound()
  return { title: page.title, alternates: { canonical: `/${countryCode}/pages/${slug}` } }
}

/** H12: صفحات السياسات والمعلومات (كانت 404) — مطلوبة قانونياً ولبوابات الدفع */
export default async function StorePage(props: Props) {
  const { slug, countryCode } = await props.params
  const page = readPage(slug)
  if (!page) notFound()
  return (
    <div className="container" style={{ maxWidth: 760, paddingBlock: 32 }}>
      <article className="prose-store" data-testid={`page-${slug}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body, `/${countryCode}`) }} />
    </div>
  )
}
