import { loadEnv, defineConfig, Modules, ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { client } from './src/lib/client'
import { BACKEND_DIR, PRIVATE_FILES_DIR, UPLOADS_DIR } from './src/lib/paths'
import { join } from 'node:path'
import { naqlaAdminBrand } from './admin-brand/vite-plugin'
import { installSecurityHeaders } from './src/api/security-headers'

// منخفضة: ترويسات الأمان على كل رد بما فيها ردود Medusa المبكرة (401/400)
installSecurityHeaders()

// C8: .env من مجلد الخادم الثابت (بعد البناء يعمل من .medusa/server)
loadEnv(process.env.NODE_ENV || 'development', BACKEND_DIR)

/**
 * A2: X-Content-Type-Options: nosniff على /static — Medusa يقدّمه بـ express.static قبل أي middleware ولا يتيح إعداده.
 * نغلّف express.static لنسخة express التي يستخدمها إطار Medusa نفسها (تُحمَّل قبل express-loader).
 * طبقة ثانية: توقيع الملف يُفحص عند الرفع (safe-file)، وCaddy يضيف الترويسة في الإنتاج.
 */
try {
  const expressPath = require.resolve('express', { paths: [require.resolve('@medusajs/framework/http')] })
  const ex = require(expressPath)
  if (!ex.__naqlaNosniff) {
    const original = ex.static
    ex.static = (root: string, opts: any = {}) =>
      original(root, {
        ...opts,
        setHeaders(res: any, path: string, stat: any) {
          res.setHeader('X-Content-Type-Options', 'nosniff')
          opts.setHeaders?.(res, path, stat)
        },
      })
    ex.__naqlaNosniff = true
  }
} catch (e) {
  console.warn(`[naqla] تعذّر إضافة nosniff إلى /static: ${(e as Error).message}`)
}

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

/**
 * سر إبطال ذاكرة المتجر (H1): الخلفية ترسله لـ /api/revalidate في الواجهة، والواجهة ترفض أقل من 32 حرفاً.
 * سر فارغ أو قصير كان يُفشل الإبطال بصمت (401 في السجل فقط) فتبقى الأسعار والمنتجات قديمة في المتجر.
 * في الإنتاج: رفض الإقلاع برسالة واضحة. في التطوير: تحذير.
 */
const revalidateSecret = process.env.REVALIDATE_SECRET ?? ""
if (revalidateSecret.length < 32) {
  const msg = `REVALIDATE_SECRET ${revalidateSecret ? `قصير (${revalidateSecret.length} حرفاً، المطلوب 32 على الأقل)` : "فارغ"} — إبطال ذاكرة المتجر سيفشل بصمت (401). شغّلي pnpm store:setup ${store.slug} --force لتوليده`
  if (process.env.NODE_ENV === "production") throw new MedusaError(MedusaError.Types.INVALID_DATA, msg)
  console.warn(`[naqla] ${msg}`)
}

/** ثواني لا يُحمَّل إلا عند THAWANI_ENABLED=true ووجود المفتاحين */
// تبويب «الدفع والتواصل»: المزوّد مسجّل دائماً — المفاتيح من الإعدادات أو .env عند الاستدعاء، وظهوره في المنطقة بشرط وجودها (M12)
const thawaniEnabled = true

module.exports = defineConfig({
  // لوحة نقلة: الهوية في رأس الصفحة فقط (admin-brand/vite-plugin.ts) — لا نسخ لكود Medusa
  admin: {
    // Medusa يدمج الناتج مع إعداده (mergeConfig): نعيد الإضافة وحدها — إعادة config كاملاً تكرر إضافة React
    vite: () => ({ plugins: [naqlaAdminBrand()] }),
  },
  projectConfig: {
    // منخفضة: جلسة الأدمن — SameSite=Strict، Secure في الإنتاج، 8 ساعات تتجدد مع النشاط، واسم لا يكشف Express
    cookieOptions: {
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 8 * 3600_000,
    },
    sessionOptions: {
      name: 'naqla_admin_sid',
      ttl: 8 * 3600_000,
      rolling: true,
    },
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
    // إعدادات المتجر من لوحة العميل (تستبدل store.json) + سجل التغييرات
    { resolve: './src/modules/store-settings' },
    // الملفات (صور المنتجات): محلياً في static/ ويُقدَّم من الخادم. للإنتاج: MEDUSA_BACKEND_URL بالنطاق العام
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            // M3: نفس المزوّد المحلي مع قائمة سماح (صور نقطية فقط للملفات العامة)
            resolve: './src/modules/safe-file',
            id: 'local',
            options: {
              // مجلد لكل متجر حتى لا تختلط الملفات عند تشغيل أكثر من متجر على الخادم نفسه
              // C8: مسار مطلق خارج .medusa — البناء لا يحذف الصور (و.medusa/server/static رابط إليه بعد البناء)
              upload_dir: join(UPLOADS_DIR, store.slug),
              // H16: لا في static (الافتراضي process.cwd()/static يجعل ملفات التصدير عامة)
              private_upload_dir: join(PRIVATE_FILES_DIR, store.slug),
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
          // H16: قناة feed (جرس اللوحة + إشعارات التصدير) — مزوّد Medusa المحلي
          { resolve: '@medusajs/medusa/notification-local', id: 'local-feed', options: { channels: ['feed'] } },
          // H17: البريد (استعادة كلمة المرور ودعوات المستخدمين): SendGrid عند ضبطه، وإلا يُكتب في السجل (تطوير)
          process.env.SENDGRID_API_KEY
            ? {
                resolve: '@medusajs/medusa/notification-sendgrid',
                id: 'sendgrid',
                options: { channels: ['email'], api_key: process.env.SENDGRID_API_KEY, from: process.env.SENDGRID_FROM ?? 'no-reply@naqla.tech' },
              }
            : { resolve: '@medusajs/medusa/notification-local', id: 'local-email', options: { channels: ['email'] } },
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
                order_canceled: process.env.WHATSAPP_TPL_ORDER_CANCELED,
                order_shipped_courier: process.env.WHATSAPP_TPL_ORDER_SHIPPED_COURIER,
                merchant_new_order: process.env.WHATSAPP_TPL_MERCHANT_NEW_ORDER,
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
