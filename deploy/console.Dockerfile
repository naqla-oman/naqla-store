# لوحة نقلة الرئيسية — صورة واحدة لخدمتين: الويب (next start) والمنفّذ (worker).
# المسار /opt/naqla مطابق لمسار المستودع على الخادم: المنفّذ يدير Docker عبر المقبس، فمسارات compose
# والتركيبات (clients/، .stores/، data/) يجب أن تعني الشيء نفسه داخل الحاوية وعلى الخادم.
FROM docker:29-cli AS dockercli

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /opt/naqla

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/storefront/package.json apps/storefront/
COPY apps/console/package.json apps/console/
RUN pnpm install --frozen-lockfile --filter @naqla/console...
COPY . .
RUN pnpm --filter @naqla/console build

FROM base AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# المنفّذ وحده يستعمل docker (المقبس يُركَّب في خدمته فقط — قرار 7)
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
COPY --from=build /opt/naqla /opt/naqla
WORKDIR /opt/naqla/apps/console
EXPOSE 7000
CMD ["npx", "next", "start", "-p", "7000"]
