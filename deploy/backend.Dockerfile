# خلفية نقلة (Medusa + لوحة التاجر) — صورة واحدة لكل المتاجر: المتجر يُحدَّد وقت التشغيل بـ STORE،
# ومجلد clients/ يُركَّب من الخادم (/app/clients) فمتجر جديد من لوحة نقلة لا يحتاج إعادة بناء.
# البناء: docker build -f deploy/backend.Dockerfile -t naqla-backend .
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/storefront/package.json apps/storefront/
COPY apps/console/package.json apps/console/
RUN pnpm install --frozen-lockfile --filter @naqla/backend...
COPY . .
# medusa-config يقرأ متجراً عند التحميل: أي متجر موجود يكفي للبناء (لوحة التاجر واحدة لكل المتاجر، والهوية تُقرأ وقت التشغيل)
ENV NAQLA_ROOT=/app NODE_OPTIONS=--max-old-space-size=2048
RUN STORE="$(ls clients | grep -v '^_' | head -n1)" && test -n "$STORE" && STORE="$STORE" pnpm --filter @naqla/backend build

FROM base AS run
ENV NODE_ENV=production NAQLA_ROOT=/app UPLOADS_DIR=/data/uploads PRIVATE_FILES_DIR=/data/private
COPY --from=build /app /app
WORKDIR /app/apps/backend/.medusa/server
RUN ln -sfn /app/apps/backend/node_modules node_modules
EXPOSE 9000
# static ← مجلد الصور الدائم (volume) عند كل تشغيل، ثم الترحيلات ومزامنة مزوّدي الدفع، ثم الخادم
CMD ["sh", "-c", "test -n \"$STORE\" && mkdir -p \"$UPLOADS_DIR\" \"$PRIVATE_FILES_DIR\" && ln -sfn \"$UPLOADS_DIR\" static && npx medusa db:migrate && npx medusa exec ./src/scripts/sync-payment-providers.js && exec npx medusa start -p 9000"]
