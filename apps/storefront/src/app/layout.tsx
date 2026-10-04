import { getBaseURL } from "@lib/util/env"
import { Metadata, Viewport } from "next"
// الخطان يحددهما store.json → fonts (ملفات جاهزة في src/fonts، الاسم المستعار في next.config)
import display from "@client-font-display"
import body from "@client-font-body"
import { clientAsset, storeConfig } from "../store.config"
import "styles/globals.css"
// ألوان العميل (نهاري/ليلي) من clients/<STORE>/theme.css
import "@client/theme.css"
import "styles/theme.css"
import "styles/product.css"
import "styles/checkout.css"
import "styles/account.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: storeConfig.name, template: `%s | ${storeConfig.name}` },
  description: storeConfig.description,
  applicationName: storeConfig.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: storeConfig.shortName, statusBarStyle: "default" },
  icons: {
    icon: [{ url: clientAsset("icons/icon-192.png"), sizes: "192x192", type: "image/png" }],
    apple: [{ url: clientAsset("icons/icon-192.png"), sizes: "192x192" }],
  },
  openGraph: {
    siteName: storeConfig.name,
    locale: storeConfig.locale.replace("-", "_"),
    images: [{ url: clientAsset("og.jpg"), width: 1600, height: 900, alt: storeConfig.name }],
  },
}

export const viewport: Viewport = {
  themeColor: storeConfig.colors.theme,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang={storeConfig.locale.split("-")[0]} dir={storeConfig.dir} data-theme="light" className={`${display.variable} ${body.variable}`}>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
