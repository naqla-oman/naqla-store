import type { Metadata } from "next"
import { IBM_Plex_Sans_Arabic } from "next/font/google"
import "./globals.css"

const body = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" })

export const metadata: Metadata = { title: { default: "لوحة نقلة", template: "%s | لوحة نقلة" }, robots: { index: false, follow: false } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={body.variable}>
      <body>{children}</body>
    </html>
  )
}
