import { getBaseURL } from "@lib/util/env"
import { Metadata, Viewport } from "next"
// الخطان يحددهما store.json → fonts (ملفات جاهزة في src/fonts، الاسم المستعار في next.config)
import display from "@client-font-display"
import body from "@client-font-body"
import latin from "@client-font-latin"
import { clientAsset, storeConfig } from "@/store.config"
import { ensureStoreSettings } from "@lib/data/store-settings"
import StoreSettingsBoot from "@modules/common/components/store-settings-boot"
import { FONT_CATALOG_CLASSES } from "../fonts/catalog"
import { fontCss, paletteCss, paletteThemeColor } from "@lib/themes"
import "styles/globals.css"
// ألوان العميل (نهاري/ليلي) من clients/<STORE>/theme.css
import "@client/theme.css"
import "styles/theme.css"
import "styles/product.css"
import "styles/checkout.css"
import "styles/account.css"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { dirOf } from "@/i18n/config"

// إعدادات اللوحة تُطبَّق قبل البيانات الوصفية (الاسم، الوصف…)
export async function generateMetadata(): Promise<Metadata> {
  await ensureStoreSettings()
  return {
    metadataBase: new URL(getBaseURL()),
    title: { default: storeConfig.name, template: `%s | ${storeConfig.name}` },
    description: storeConfig.description,
    applicationName: storeConfig.name,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: storeConfig.shortName, statusBarStyle: "default" },
    icons: {
      icon: [
        ...(storeConfig.icons.svg ? [{ url: clientAsset(storeConfig.icons.svg), type: "image/svg+xml" }] : []),
        { url: clientAsset(storeConfig.icons.icon192), sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: clientAsset(storeConfig.icons.apple) }],
    },
    openGraph: {
      siteName: storeConfig.name,
      locale: storeConfig.locale.replace("-", "_"),
      // أبعاد الصورة كما في مجلد العميل (لا تُفرض هنا)
      images: [{ url: clientAsset("og.jpg"), alt: storeConfig.name }],
    },
  }
}

export async function generateViewport(): Promise<Viewport> {
  await ensureStoreSettings()
  return {
    themeColor: paletteThemeColor(storeConfig.theme.palette) ?? storeConfig.colors.theme,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  // إعدادات اللوحة: تُطبَّق قبل رسم الصفحات، وتُمرَّر للمتصفح قبل الحِزم
  const settings = await ensureStoreSettings()
  // اللغة من الوسيط (x-naqla-lang): العربية الأصل، والإنجليزية طبقة فوقها
  const locale = await getLocale()
  const messages = await getMessages()
  const boot = `window.__NAQLA_SETTINGS__=${JSON.stringify(settings).replace(/</g, "\\u003c")}`
  // الهوية: لوحة وخط من «إعدادات المتجر» (فوق theme.css وخطوط البناء)
  const identityCss = [paletteCss(storeConfig.theme.palette), fontCss(storeConfig.theme.font)].filter(Boolean).join("\n")
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme={storeConfig.defaultTheme} className={`${display.variable} ${body.variable} ${latin.variable} ${FONT_CATALOG_CLASSES}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        {identityCss && <style id="naqla-identity" dangerouslySetInnerHTML={{ __html: identityCss }} />}
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}><main className="relative"><StoreSettingsBoot settings={settings}>{props.children}</StoreSettingsBoot></main></NextIntlClientProvider>
      </body>
    </html>
  )
}
