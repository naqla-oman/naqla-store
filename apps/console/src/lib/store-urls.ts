/**
 * روابط المتجر ولوحته: في الإنتاج (السائق docker) من نطاقه — نطاق المنصة <slug>.<PLATFORM_DOMAIN> خادمه
 * api-<slug>.<PLATFORM_DOMAIN>، ودومين العميل خادمه api.<domain> (القاعدة نفسها في deploy/naqla.mjs → domainsOf)؛
 * وفي التطوير (local) من المنافذ.
 */
export function storeUrls(s: { slug: string; domain?: string | null; backend_port?: number | null; storefront_port?: number | null }) {
  if (process.env.CONSOLE_DRIVER === "docker" && s.domain) {
    const p = process.env.PLATFORM_DOMAIN
    const api = p && s.domain === `${s.slug}.${p}` ? `api-${s.slug}.${p}` : `api.${s.domain}`
    return { panel: `https://${api}/app`, store: `https://${s.domain}` }
  }
  return {
    panel: s.backend_port ? `http://localhost:${s.backend_port}/app` : null,
    store: s.storefront_port ? `http://localhost:${s.storefront_port}` : null,
  }
}
