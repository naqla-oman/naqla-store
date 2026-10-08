# واجهة متجر واحد — الخطوط والثيم وstore.json تُترجَم وقت البناء، فالصورة لكل متجر (naqla-storefront-<slug>).
# تُبنى والخلفية تعمل (تجهيز الصفحات المسبق يقرأ المنتجات): deploy/naqla.sh يمرّر --network host
# و--add-host backend-<slug>:<عنوان الحاوية> فيكون عنوان الخلفية وقت البناء هو نفسه وقت التشغيل.
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/storefront/package.json apps/storefront/
COPY apps/console/package.json apps/console/
RUN pnpm install --frozen-lockfile --filter @naqla/storefront...
COPY . .
ARG STORE
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG MEDUSA_BACKEND_URL
ARG MEDUSA_PUBLIC_URL
ENV STORE=${STORE} CLIENTS_DIR=/app/clients NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL} \
    MEDUSA_PUBLIC_URL=${MEDUSA_PUBLIC_URL} NEXT_PUBLIC_DEFAULT_REGION=om
RUN test -n "$STORE" && test -f "clients/$STORE/store.json" && pnpm --filter @naqla/storefront build

FROM base AS run
ENV NODE_ENV=production CLIENTS_DIR=/app/clients NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
WORKDIR /app/apps/storefront
EXPOSE 8000
CMD ["npx", "next", "start", "-p", "8000"]
