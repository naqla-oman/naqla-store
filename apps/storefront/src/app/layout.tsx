import { getBaseURL } from "@lib/util/env"
import { Metadata, Viewport } from "next"
import { Alexandria, IBM_Plex_Sans_Arabic } from "next/font/google"
import { storeConfig } from "../store.config"
import "styles/globals.css"
import "styles/theme.css"

const display = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
})
const body = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: storeConfig.name, template: `%s | ${storeConfig.name}` },
  description: storeConfig.description,
  applicationName: storeConfig.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: storeConfig.shortName, statusBarStyle: "default" },
}

export const viewport: Viewport = {
  themeColor: "#0f4a3c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir={storeConfig.dir} data-theme="light" className={`${display.variable} ${body.variable}`}>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
