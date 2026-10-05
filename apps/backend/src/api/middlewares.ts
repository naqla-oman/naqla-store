import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { requireExistingAdmin } from './admin-user-guard'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
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
