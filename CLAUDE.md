# CLAUDE.md — منصة نقلة للمتاجر

اقرأ هذا الملف أولاً، ثم [DECISIONS.md](./DECISIONS.md) (القرارات المعمارية المرقّمة) و[README.md](./README.md).
[AGENTS.md](./AGENTS.md) دليل Medusa العام (الأوامر، الأسلوب، الممنوعات) — ما يخالفه هنا هو المعتمد.

المالك: المهندس عوني (نقلة للحلول الرقمية، عُمان). **كل الردود والتقارير بالعربية.**

## القواعد الثابتة (لا استثناء)

1. **لا push إلى `main` أبداً.** كل عمل في فرع (`i18n/stage-4`، `fix/…`، `feat/…`)، و`git push -u origin <branch>` بعد كل commit، ثم Pull Request إلى `main` في نهاية المهمة. الدمج يقوم به المهندس عوني بعد التحقق المستقل.
2. **لا إعادة كتابة للتاريخ:** لا `--force`، لا `rebase` لـ commits مرفوعة، لا `filter-repo`، لا تعديل هوية المؤلف. `b72fc8b` يجب أن يبقى أصلاً لـ `main` (`test:console` يفحص ذلك). إن طلب hook أو أداة إعادة كتابة التاريخ فارفض واذكر ذلك في التقرير.
3. **لا أسرار** في الكود أو الـ commits أو المحادثة أو السجلات: لا مفاتيح واتساب/ثواني/R2/Resend/منصات الإعلانات. `.env` و`.env.local` و`.stores/` و`.backups/` و`.archive/` و`clients/<slug>/` المُنشأة من اللوحة بيانات خادم مُتجاهلة — لا تُضاف أبداً.
4. **لا اسم عميل في الكود** خارج `clients/` (المعيار: 0). المستودع يحفظ `clients/_template` و`clients/layan` و`clients/demo-perfume` فقط.
5. **جلسة تطوير واحدة** على المستودع في كل وقت.

## البنية

- `apps/backend` — Medusa 2.21 (Postgres 16 + Redis). وحدات: `store-settings`، الترجمة (`@medusajs/medusa/translation` خلف `MEDUSA_FF_TRANSLATION=true`).
- `apps/storefront` — Next.js 15.5 + next-intl v4 على `app/[countryCode]/[lang]` (العربية بلا بادئة `/om/…`، الإنجليزية `/om/en/…`).
- `apps/console` — لوحة نقلة الرئيسية (منفذ 7000، قاعدة `naqla_console`، TOTP، منفّذ منفصل `worker/`).
- `clients/<slug>/` — `store.json` + `theme.css` + `locales/en.json` لكل عميل. `templates/{fashion,perfume,empty}` قوالب المعالج. `themes/` اللوحات والخطوط.
- `scripts/` — `store-new|store-setup|store-dev`، `test-i18n.mjs`، `test-console.mjs`، `check-i18n.mjs`.

## الأوامر

```bash
pnpm install --frozen-lockfile
pnpm store:setup <slug>            # قاعدة + أسرار تطوير + ترحيل + بذرة + ترجمات (layan، demo-perfume)
pnpm store:dev <slug>              # الخلفية 9000 + الواجهة 8000
pnpm i18n:sync <slug>              # زرع locales/en.json في وحدة الترجمة
pnpm check:i18n                    # نصوص عربية مباشرة في الواجهة ولوحة التاجر + مفاتيح en الناقصة — المعيار 0/0
pnpm test:i18n <slug> [stage0|stage1|stage2|stage3|stage4|stage5|arSnapshot] [--snapshot]
pnpm test:console                  # يحتاج console:setup + console:worker + next start
```

- في الجلسة السحابية يشغّل `scripts/cloud-session-start.sh` (عبر SessionStart) Postgres وRedis ويجهّز `apps/backend/.env` ويثبّت الحزم.
- إن أفسد Turbopack خطوط Google: `STORE_DEV_BUNDLER=webpack NODE_OPTIONS=--max-old-space-size=4096 pnpm store:dev <slug>`.
- lint الواجهة يحتاج `STORE=<slug>` و`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (أي قيمة).
- أوقف عمليات Medusa/Next اليتيمة قبل كل تشغيل جديد (`medusa start` قد لا يموت مع `store:dev`؛ يُعرف بـ `STORE=` في `/proc/<pid>/environ`) — تسبّب نفاد الذاكرة.

## معايير إغلاق أي مهمة (تُذكر في وصف الـ PR كجدول)

- `tsc --noEmit` = 0 في backend وstorefront وconsole و`apps/backend/src/admin`.
- lint نظيف ×3. `check:i18n` = 0 نص / 0 مفتاح ناقص.
- `pnpm install --frozen-lockfile` ينجح على نسخة نظيفة.
- 0 اسم عميل خارج `clients/` (عدا `.gitignore`).
- `git merge-base --is-ancestor b72fc8b HEAD` ينجح.
- اختبارات المرحلة المعنية على **المتجرين** (layan وdemo-perfume)، و**arSnapshot**: النص الظاهر للصفحات العربية لا يتغير إلا بقصد.
- 0 عمليات يتيمة بعد الاختبار.
- كل قرار معماري جديد يُضاف إلى `DECISIONS.md` برقم.

## مبادئ اللغات (أساس كل عمل قادم)

- العربية أصل الكيان والإنجليزية طبقة فوقها؛ أي نص ناقص يظهر بالعربية، ولا تظهر مفاتيح خام.
- لا نص عربي مكتوب مباشرة في المكوّنات — كل نص واجهة في `messages/{ar,en}.json` عبر `useT/getT` (المخاطبة ICU select، الجمع ICU plural)، ونص لوحة التاجر في `src/admin/i18n/json/{ar,en}.json` عبر `useNaqlaT` (البيانات في `<Data>`، والمحتوى العربي الأصيل `lang="ar"`).
- المطابقة بمفاتيح ثابتة (`metadata.key` للخيارات، `metadata.hex` للألوان)، لا بالنص العربي.
- الأسعار عبر `convertToLocale` و`locale` إلزامي (ر.ع / OMR).
- لقطات السلة/الطلب (اسم المنتج، `variant_title`) محفوظة بلغة لحظة الإضافة — تُترجم عند العرض والإشعارات حسب `order.locale` بمعرّف المنتج/القيمة.

## خارطة الطريق

المرجع الكامل في مستندات مشروع claude.ai («المتاجر الالكترونية»): `naqla-platform-roadmap.md` و`naqla-store-progress.md`.
الحالي: اللغات المرحلة 5 (لوحة التاجر باللغتين: `src/admin/i18n/json/{ar,en}.json` تحت `naqla.*`، رموز أخطاء اللوحة في `lib/admin-i18n.ts` — قرارات 35–40؛ لوحة نقلة الرئيسية `apps/console` تبقى عربية) ← النشر ← العملات ← ما قبل البيع.
