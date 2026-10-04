# منصة نقلة للمتاجر الإلكترونية — Naqla Store Platform

منصة متاجر إلكترونية قابلة للتكرار لعملاء **نقلة للحلول الرقمية** في سلطنة عُمان.
كل متجر عميل = نسخة من هذا المستودع + ملف بيانات واحد + ملف إعدادات واحد.

| الطبقة | التقنية | المجلد |
|---|---|---|
| الواجهة الخلفية + لوحة الإدارة | Medusa v2 (Node 22, PostgreSQL 16, Redis) | `apps/backend` |
| واجهة المتجر (PWA) | Next.js 15 App Router + Tailwind | `apps/storefront` |

المتجر الأول: **بوتيك ليان** (أزياء — عبايات وفساتين) بهوية «زمرد ومسك».

## التشغيل محلياً

```bash
pnpm install
# قاعدة البيانات
createdb naqla_layan            # أو عدّل DATABASE_URL في apps/backend/.env
cp apps/backend/.env.template apps/backend/.env
cp apps/storefront/.env.template apps/storefront/.env.local

# تهيئة الخلفية وبذر بيانات ليان (تُقرأ من apps/backend/data/layan.json)
cd apps/backend && npx medusa db:migrate && npx medusa user -e admin@naqla.om -p <password>
# انسخ مفتاح النشر الذي يطبعه السكربت إلى NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY في الواجهة

pnpm run backend:dev     # http://localhost:9000  — لوحة الإدارة /app
pnpm run storefront:dev  # http://localhost:8000
```

## إنشاء متجر لعميل جديد

1. انسخ `apps/backend/data/layan.json` إلى `data/<client>.json` وعدّل المنتجات والأقسام والتوصيل.
2. عدّل `apps/storefront/src/store.config.ts` (الاسم، التواصل، القائمة، الشريط) و`src/styles/theme.css` (الألوان).
3. ضع صور المنتجات في `apps/storefront/public/img/` (أو ارفعها من لوحة الإدارة لاحقاً).
4. `STORE_DATA=<client> npx medusa db:migrate` على قاعدة بيانات جديدة.

## ما تم إنجازه

- [x] Medusa v2: منطقة عُمان (OMR)، ضريبة القيمة المضافة 5٪ والأسعار شاملة لها، موقع مخزون «المشغل»، ثلاث طرق توصيل (عادي/سريع/استلام) مع توصيل مجاني فوق 20 ر.ع، أقسام ومجموعات ووسوم المناسبات، 12 منتجاً بمقاساتها وألوانها ومخزونها.
- [x] Next.js: RTL + خطوط عربية، رموز الهوية (نهاري/ليلي)، الهيدر والشريط المتحرك والقائمة الجانبية وشريط التبويبات السفلي والفوتر، الهيرو، بطاقات المنتجات بالريال العُماني، manifest للتطبيق.
- [x] صفحة المنتج بهوية ليان: معرض بسحب وعارض مكبّر، اللون والمقاس من متغيّرات المنتج مع حالات المخزون، موعد التوصيل بتوقيت مسقط، طول العباءة يُحفظ في السلة (`metadata.length_cm`)، الطلب والإشعار عبر واتساب، أكملي الإطلالة، المنتجات المشابهة، شريط شراء مثبّت، SEO وJSON-LD. الإعدادات في `store.config.ts → product`.
- [ ] السلة والدفع (ثواني، الدفع عند الاستلام، واتساب) وخطوات الدفع
- [ ] الحساب، التتبّع، المفضلة، برنامج الولاء
- [ ] مزوّد دفع ثواني (Thawani) كـ Payment Module
- [ ] إشعارات واتساب للطلبات
- [ ] Docker Compose + Caddy للنشر على Hetzner

## ملاحظات تقنية

- خيارات Medusa v2.21 مشتركة بين كل المنتجات (خيار «المقاس» يحمل قيم كل المنتجات)، لذلك تُستخرج المقاسات والألوان من متغيّرات المنتج في `modules/products/lib/variants.ts` وليس من قيم الخيار.
- التقسيط (`product.bnpl.enabled`) مُعطّل حتى يُربط مزوّده فعلياً في الدفع.

## المرجع البصري

الديمو المعتمد: `https://claude.ai/artifact/CViY3Rs2vpsXb2N81ndN7j` — كل صفحة في المتجر الحقيقي تُطابقه.
