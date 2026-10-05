const path = require("path")
const checkEnvVariables = require("./check-env-variables")
const { clientDir, clientStore } = require("./client")

checkEnvVariables()

// العميل من STORE: كل ما يخصه يُقرأ من clients/<STORE>/ عبر أسماء مستعارة — لا نسخ ملفات
const CLIENT_DIR = clientDir()
const CLIENT = clientStore()
const ALIASES = {
  "@client": CLIENT_DIR,
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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
    // ملف tsconfig لكل متجر يعمل جنباً إلى جنب (store:dev يُنشئه ويرث tsconfig.json)
    ...(process.env.NEXT_TSCONFIG ? { tsconfigPath: process.env.NEXT_TSCONFIG } : {}),
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      // صور المنتجات من وحدة الملفات في Medusa (<backend>/static/...)
      ...(BACKEND_HOST && BACKEND_HOST.hostname !== "localhost"
        ? [{ protocol: BACKEND_HOST.protocol.replace(":", ""), hostname: BACKEND_HOST.hostname, pathname: "/static/**" }]
        : []),
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
