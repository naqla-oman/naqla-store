import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { requireExistingAdmin } from './admin-user-guard'
import { securityHeaders } from './security-headers'
import { rateLimit } from '../lib/rate-limit'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    // H8: ترويسات الأمان لكل مسارات الخلفية
    { matcher: '/*', middlewares: [securityHeaders] },
    // H5: حدود المعدل (Redis عند توفره)
    {
      // دخول الأدمن: 20 محاولة لكل IP و10 لكل بريد في 15 دقيقة
      method: ['POST'],
      matcher: '/auth/user/emailpass',
      middlewares: [
        rateLimit([
          { name: 'admin-login-ip', max: 20, windowMs: 15 * 60_000, message: 'محاولات دخول كثيرة — حاول بعد 15 دقيقة' },
          {
            name: 'admin-login-email',
            max: 10,
            windowMs: 15 * 60_000,
            key: (req) => String((req.body as any)?.email ?? '').trim().toLowerCase() || null,
            message: 'محاولات دخول كثيرة لهذا الحساب — حاول بعد 15 دقيقة',
          },
        ]),
      ],
    },
    {
      // تتبّع الطلب: يمنع تعداد أرقام الطلبات المتسلسلة
      method: ['POST'],
      matcher: '/store/track',
      // المصادقة اختيارية: الزبونة المسجّلة لا تحتاج هاتفاً لطلباتها
      middlewares: [authenticate('customer', ['bearer', 'session'], { allowUnauthenticated: true }), rateLimit([{ name: 'track', max: 20, windowMs: 60 * 60_000, message: 'محاولات تتبّع كثيرة — حاول بعد ساعة' }])],
    },
    {
      method: ['POST'],
      matcher: '/store/carts/:id/complete',
      middlewares: [rateLimit([{ name: 'complete', max: 30, windowMs: 60 * 60_000 }])],
    },
    {
      method: ['POST'],
      matcher: '/store/phone-account',
      middlewares: [rateLimit([{ name: 'signup', max: 10, windowMs: 60 * 60_000 }])],
    },
    {
      // C3: مستخدم الأدمن في الرمز يجب أن يكون موجوداً فعلاً
      matcher: '/admin/*',
      middlewares: [authenticate('user', ['bearer', 'session'], { allowUnregistered: true }), requireExistingAdmin],
    },
    {
      // إنشاء الحساب بعد رمز واتساب: يقبل رمز تسجيل بلا زبونة بعد
      method: ['POST'],
      matcher: '/store/phone-account',
      middlewares: [authenticate('customer', ['bearer', 'session'], { allowUnregistered: true })],
    },
    {
      // الهاتف هو هوية الدخول — لا يُغيَّر من واجهة المتجر
      method: ['POST'],
      matcher: '/store/customers/me',
      middlewares: [
        async (req: any, res: any, next: any) => {
          if (req.body && 'phone' in req.body) {
            return res.status(400).json({ message: 'لا يمكن تغيير رقم الهاتف لأنه وسيلة الدخول' })
          }
          next()
        },
      ],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
