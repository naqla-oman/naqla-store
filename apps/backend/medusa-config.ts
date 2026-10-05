import { loadEnv, defineConfig, Modules, ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { client } from './src/lib/client'
import { naqlaAdminBrand } from './admin-brand/vite-plugin'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// العميل من STORE (إلزامي) — كل ما يخص المتجر في clients/<STORE>/store.json
const store = client()

/**
 * C3: أسرار JWT/الكوكي لكل متجر (يولّدها store:setup بطول 48 بايت).
 * في الإنتاج يُرفض الإقلاع بسر فارغ أو افتراضي أو قصير؛ في التطوير تحذير فقط.
 */
const WEAK = new Set(["supersecret", "secret", "change-me", "changeme", "test"])
function secret(name: "JWT_SECRET" | "COOKIE_SECRET") {
  const v = process.env[name] ?? ""
  if (!v || v.length < 32 || WEAK.has(v)) {
    if (process.env.NODE_ENV === "production") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${name} فارغ أو ضعيف — شغّلي pnpm store:setup ${store.slug} --force لتوليد أسرار المتجر`)
    }
    console.warn(`[naqla] ${name} ضعيف أو غير مضبوط — مقبول في التطوير فقط`)
  }
  return v || "dev-only-insecure-secret-do-not-use-in-production"
}

/** ثواني لا يُحمَّل إلا عند THAWANI_ENABLED=true ووجود المفتاحين */
const thawaniEnabled =
  process.env.THAWANI_ENABLED === 'true' &&
  !!process.env.THAWANI_SECRET_KEY &&
  !!process.env.THAWANI_PUBLISHABLE_KEY

module.exports = defineConfig({
  // لوحة نقلة: الهوية في رأس الصفحة فقط (admin-brand/vite-plugin.ts) — لا نسخ لكود Medusa
  admin: {
    // Medusa يدمج الناتج مع إعداده (mergeConfig): نعيد الإضافة وحدها — إعادة config كاملاً تكرر إضافة React
    vite: () => ({ plugins: [naqlaAdminBrand()] }),
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: secret("JWT_SECRET"),
      cookieSecret: secret("COOKIE_SECRET"),
      // الزبونات: رمز واتساب (phone-auth) — المسؤولون: البريد وكلمة المرور
      authMethodsPerActor: {
        user: ['emailpass'],
        customer: ['phone-auth'],
      },
    }
  },
  modules: [
    // أدوات التتبع (المعرّفات والرموز في الخادم) + تحويلات 301 للسيو
    { resolve: './src/modules/tracking' },
    // الملفات (صور المنتجات): محلياً في static/ ويُقدَّم من الخادم. للإنتاج: MEDUSA_BACKEND_URL بالنطاق العام
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-local',
            id: 'local',
            options: {
              // مجلد لكل متجر حتى لا تختلط الملفات عند تشغيل أكثر من متجر على الخادم نفسه
              upload_dir: `static/${store.slug}`,
              backend_url: `${process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'}/static/${store.slug}`,
            },
          },
        ],
      },
    },
    // نقاط الولاء من store.json → loyalty (معلّقة حتى التوصيل)
    {
      resolve: './src/modules/loyalty',
      options: {
        pointsPerUnit: store.loyalty.pointsPerUnit,
        redeemPoints: store.loyalty.redeemPoints,
        redeemValue: store.loyalty.redeemValue,
        tiers: store.loyalty.tiers.map((t) => ({ key: t.key, name: t.name, min: t.min })),
      },
    },
    {
      resolve: '@medusajs/medusa/auth',
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER, Modules.EVENT_BUS],
      options: {
        providers: [
          { resolve: '@medusajs/medusa/auth-emailpass', id: 'emailpass' },
          {
            resolve: './src/modules/phone-auth',
            id: 'phone-auth',
            options: { secret: process.env.PHONE_AUTH_SECRET },
          },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: './src/modules/whatsapp-notification',
            id: 'whatsapp',
            options: {
              channels: ['whatsapp'],
              enabled: process.env.WHATSAPP_ENABLED === 'true',
              accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE,
              orderTemplates: {
                order_placed: process.env.WHATSAPP_TPL_ORDER_PLACED,
                order_shipped: process.env.WHATSAPP_TPL_ORDER_SHIPPED,
                order_ready_pickup: process.env.WHATSAPP_TPL_ORDER_READY_PICKUP,
                order_delivered: process.env.WHATSAPP_TPL_ORDER_DELIVERED,
              },
              language: process.env.WHATSAPP_TEMPLATE_LANG || 'ar',
            },
          },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          // الدفع عند الاستلام + واتساب: pp_cod_offline و pp_whatsapp_offline
          { resolve: './src/modules/offline-payment', id: 'offline' },
          ...(thawaniEnabled
            ? [{
                resolve: './src/modules/thawani',
                id: 'thawani',
                options: {
                  secretKey: process.env.THAWANI_SECRET_KEY,
                  publishableKey: process.env.THAWANI_PUBLISHABLE_KEY,
                  mode: process.env.THAWANI_MODE === 'live' ? 'live' : 'uat',
                  storefrontUrl: process.env.STOREFRONT_URL,
                },
              }]
            : []),
        ],
      },
    },
  ],
})
