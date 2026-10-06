import type { MetadataRoute } from "next"
import { clientAsset, storeConfig } from "../store.config"
import { ensureStoreSettings } from "@lib/data/store-settings"

// إعدادات المتجر (الاسم والأيقونات) تُطبَّق قبل البناء — مسار مستقل لا يمر بالتخطيط الجذري
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await ensureStoreSettings()
  return {
    name: storeConfig.name,
    short_name: storeConfig.shortName,
    description: storeConfig.description,
    start_url: "/",
    display: "standalone",
    dir: storeConfig.dir,
    lang: storeConfig.locale.split("-")[0],
    background_color: storeConfig.colors.background,
    theme_color: storeConfig.colors.theme,
    icons: [
      { src: clientAsset(storeConfig.icons.icon192), sizes: "192x192", type: "image/png" },
      { src: clientAsset(storeConfig.icons.icon512), sizes: "512x512", type: "image/png" },
      { src: clientAsset(storeConfig.icons.maskable), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
