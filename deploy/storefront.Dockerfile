# واجهة متجر واحد — المعرّفات العامة تُثبَّت وقت البناء (NEXT_PUBLIC_*)
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/storefront/package.json apps/storefront/
RUN pnpm install --frozen-lockfile --filter @naqla/storefront...
COPY . .
ARG STORE
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG MEDUSA_BACKEND_URL
ENV STORE=${STORE} CLIENTS_DIR=/app/clients NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL} \
    NEXT_PUBLIC_DEFAULT_REGION=om
RUN test -n "$STORE" && pnpm --filter @naqla/storefront build

FROM base AS run
ENV NODE_ENV=production CLIENTS_DIR=/app/clients NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
WORKDIR /app/apps/storefront
EXPOSE 8000
CMD ["npx", "next", "start", "-p", "8000"]
