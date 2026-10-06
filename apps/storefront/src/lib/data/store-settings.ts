import "server-only"
import { sdk } from "@lib/config"
import { applyStoreOverrides } from "../../store.config"

/**
 * إعدادات اللوحة (وحدة store-settings) — وسم «store-settings» يُبطَل عند كل حفظ فيظهر التغيير خلال ثوانٍ.
 * عند تعذّر الخادم تبقى قيم store.json (لا تنكسر الواجهة).
 */
export async function getStoreOverrides(): Promise<Record<string, unknown>> {
  try {
    const r = await sdk.client.fetch<{ overrides: Record<string, unknown> }>("/store/naqla/settings", {
      next: { tags: ["store-settings"] },
      cache: "force-cache",
    })
    return r?.overrides ?? {}
  } catch {
    return {}
  }
}

/** يطبّق الإعدادات على storeConfig ويعيدها لتمريرها للمتصفح */
export async function ensureStoreSettings() {
  const o = await getStoreOverrides()
  applyStoreOverrides(o)
  return o
}
