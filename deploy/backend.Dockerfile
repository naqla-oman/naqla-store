# خلفية متجر واحد (Medusa + لوحة نقلة) — يُبنى لكل متجر بـ --build-arg STORE=<slug>
# البناء: docker build -f deploy/backend.Dockerfile --build-arg STORE=<slug> -t naqla-backend-<slug> .
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/storefront/package.json apps/storefront/
RUN pnpm install --frozen-lockfile --filter @naqla/backend...
COPY . .
ARG STORE
ENV STORE=${STORE} NAQLA_ROOT=/app
# medusa build + postbuild (نسخ admin-brand) — الأسرار ليست مطلوبة وقت البناء
RUN test -n "$STORE" && pnpm --filter @naqla/backend build

FROM base AS run
ENV NODE_ENV=production NAQLA_ROOT=/app UPLOADS_DIR=/data/uploads
COPY --from=build /app /app
WORKDIR /app/apps/backend/.medusa/server
RUN ln -sfn /app/apps/backend/node_modules node_modules
EXPOSE 9000
# static ← مجلد الصور الدائم (volume) عند كل تشغيل، ثم الترحيلات، ثم الخادم
CMD ["sh", "-c", "mkdir -p \"$UPLOADS_DIR\" && ln -sfn \"$UPLOADS_DIR\" static && npx medusa db:migrate && npx medusa exec ./src/scripts/sync-payment-providers.js && exec npx medusa start -p 9000"]
