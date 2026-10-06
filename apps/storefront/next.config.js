const path = require("path")
const checkEnvVariables = require("./check-env-variables")
const { clientDir, clientStore } = require("./client")

checkEnvVariables()

// العميل من STORE: كل ما يخصه يُقرأ من clients/<STORE>/ عبر أسماء مستعارة — لا نسخ ملفات
const CLIENT_DIR = clientDir()
const CLIENT = clientStore()
const ALIASES = {
  "@client": CLIENT_DIR,
  // لوحات نقلة وأزواج الخطوط (مصدر واحد مع الخادم) — تبويب «الهوية»
  "@naqla-themes": path.join(__dirname, "../../themes"),
  "@client-font-display": path.join(__dirname, "src/fonts/display", `${CLIENT.fonts.display}.ts`),
  "@client-font-body": path.join(__dirname, "src/fonts/body", `${CLIENT.fonts.body}.ts`),
  "@client-font-latin": path.join(__dirname, "src/fonts/latin", `${CLIENT.fonts.latin}.ts`),
}
// Turbopack: مسارات نسبية من جذر التطبيق، ولا يطابق البادئات إلا بصيغة النجمة (@client/*)
const rel = (v) => "./" + path.relative(__dirname, v).split(path.sep).join("/")
const TURBO_ALIASES = {
  ...Object.fromEntries(Object.entries(ALIASES).map(([k, v]) => [k, rel(v)])),
  "@client/*": rel(CLIENT_DIR) + "/*",
}

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const BACKEND_HOST = (() => {
  try {
    return process.env.MEDUSA_BACKEND_URL ? new URL(process.env.MEDUSA_BACKEND_URL) : null
  } catch {
    return null
  }
})()

// H8: ترويسات أمان (Caddy يضيف HSTS وCSP في الإنتاج — هذه طبقة ثانية لا تعتمد عليه)
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },
  // مجلد بناء لكل متجر حتى لا يتصادم متجران يعملان من نفس المجلد (store:dev يضبطه)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // ملفات العميل خارج مجلد التطبيق (clients/)
  experimental: { externalDir: true },
  turbopack: { resolveAlias: TURBO_ALIASES },
  webpack: (config) => {
    Object.assign(config.resolve.alias, ALIASES)
    return config
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // منخفضة: البناء لا يتجاهل أخطاء ESLint وTypeScript (كان يمرّرها إلى الإنتاج)
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
    // ملف tsconfig لكل متجر يعمل جنباً إلى جنب (store:dev يُنشئه ويرث tsconfig.json)
    ...(process.env.NEXT_TSCONFIG ? { tsconfigPath: process.env.NEXT_TSCONFIG } : {}),
  },
  images: {
    // M5: محسّن الصور يجلب من الخلفية فقط — مضيفها ومنفذها ومسار /static/** (لا أي مسار على localhost: SSRF)،
    // وlocalhost في التطوير فقط. حذف حاويات Medusa التجريبية من القالب.
    remotePatterns: BACKEND_HOST
      ? [
          {
            protocol: BACKEND_HOST.protocol.replace(":", ""),
            hostname: BACKEND_HOST.hostname,
            ...(BACKEND_HOST.port ? { port: BACKEND_HOST.port } : {}),
            pathname: "/static/**",
          },
        ].filter((p) => p.hostname !== "localhost" || process.env.NODE_ENV !== "production")
      : [],

  },
}

module.exports = nextConfig
