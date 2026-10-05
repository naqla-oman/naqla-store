import { loadEnv, defineConfig, Modules, ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { client } from './src/lib/client'
import { BACKEND_DIR, UPLOADS_DIR } from './src/lib/paths'
import { join } from 'node:path'
import { naqlaAdminBrand } from './admin-brand/vite-plugin'

// C8: .env من مجلد الخادم الثابت (بعد البناء يعمل من .medusa/server)
loadEnv(process.env.NODE_ENV || 'development', BACKEND_DIR)

// العميل من STORE (إلزامي) — كل ما يخص المتجر في clients/<STORE>/store.json
const store = client()

/**
 * H6: Redis للأحداث وworkflows والأقفال والكاش والجلسات — عند وجود REDIS_URL فقط (التطوير بدونه يعمل في الذاكرة).
 * بادئة لكل متجر حتى تتشارك المتاجر خادم Redis واحداً دون تداخل.
 */
const REDIS_URL = process.env.REDIS_URL
const REDIS_PREFIX = `naqla:${store.slug}:`
// أسماء طوابير BullMQ لا تقبل «:» — بادئة بالشرطات للأحداث والـworkflows
const QUEUE_PREFIX = `naqla-${store.slug}-`
const redisModules = REDIS_URL
  ? [
      { resolve: '@medusajs/medusa/event-bus-redis', options: { redisUrl: REDIS_URL, queueName: `${QUEUE_PREFIX}events` } },
      { resolve: '@medusajs/medusa/workflow-engine-redis', options: {
          redis: {
            redisUrl: REDIS_URL,
            queueName: `${QUEUE_PREFIX}workflows`,
            jobQueueName: `${QUEUE_PREFIX}workflows-jobs`,
            // اسم طابور التنظيف ثابت في المحرّك: نفصل المتاجر ببادئة BullMQ (للطابور والعامل معاً)
            cleanerQueueOptions: { prefix: `bull-${QUEUE_PREFIX}cleaner` },
            cleanerWorkerOptions: { prefix: `bull-${QUEUE_PREFIX}cleaner` },
          },
        },
      },
      { resolve: '@medusajs/medusa/cache-redis', options: { redisUrl: REDIS_URL, namespace: `${REDIS_PREFIX}cache` } },
      {
        resolve: '@medusajs/medusa/locking',
        options: {
          providers: [
            { resolve: '@medusajs/medusa/locking-redis', id: 'locking-redis', is_default: true, options: { redisUrl: REDIS_URL, namespace: `${REDIS_PREFIX}lock` } },
          ],
        },
      },
    ]
  : []

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
    // H6: الجلسات في Redis (تبقى بعد إعادة التشغيل وتعمل مع أكثر من عملية)
    ...(REDIS_URL ? { redisUrl: REDIS_URL, redisPrefix: `${REDIS_PREFIX}sess:` } : {}),
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
    ...redisModules,
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
              // C8: مسار مطلق خارج .medusa — البناء لا يحذف الصور (و.medusa/server/static رابط إليه بعد البناء)
              upload_dir: join(UPLOADS_DIR, store.slug),
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
            // C2+H6: أقفال الرموز وحدود IP في Redis عند توفره (مشتركة بين العمليات)
            options: { secret: process.env.PHONE_AUTH_SECRET, redisUrl: REDIS_URL, redisPrefix: `${REDIS_PREFIX}otp:` },
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
