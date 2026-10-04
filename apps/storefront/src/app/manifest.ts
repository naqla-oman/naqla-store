import type { MetadataRoute } from "next"
import { clientAsset, storeConfig } from "../store.config"

export default function manifest(): MetadataRoute.Manifest {
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
      { src: clientAsset("icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: clientAsset("icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
