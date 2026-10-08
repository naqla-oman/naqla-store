#!/usr/bin/env bash
# تثبيت منصة نقلة على خادم جديد (أو تحديثها بعد git pull). يُشغَّل بصلاحية root من /opt/naqla:
#   deploy/install.sh <platform-domain> [acme-email]   أول مرة (مثال: deploy/install.sh omnaqla.shop info@naqla.tech)
#   deploy/install.sh --update                          بعد git pull: إعادة بناء الصور وتحديث كل المتاجر
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ "$ROOT" = "/opt/naqla" ] || { echo "✖ المستودع يجب أن يكون في /opt/naqla (المنفّذ يدير Docker بالمسارات نفسها)"; exit 1; }
command -v docker >/dev/null || { echo "✖ Docker غير مثبّت"; exit 1; }
COMPOSE=(docker compose -p naqla --project-directory deploy -f deploy/docker-compose.yml)

mkdir -p data .stores .backups .archive deploy/stores deploy/sites
chmod 700 .stores .backups

if [ "${1:-}" != "--update" ]; then
  DOMAIN="${1:?الاستخدام: deploy/install.sh <platform-domain> [acme-email]}"
  if [ ! -f deploy/.env ]; then
    IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
    umask 077
    cat > deploy/.env <<ENV
# منصة نقلة على هذا الخادم — أنشأه deploy/install.sh (خارج Git، صلاحيات 600)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
PLATFORM_DOMAIN=${DOMAIN}
PLATFORM_IP=${IP}
ACME_EMAIL=${2:-info@naqla.tech}
ENV
    echo "✔ deploy/.env أُنشئ (النطاق ${DOMAIN}، العنوان ${IP})"
  fi
fi
chmod 600 deploy/.env

echo "▶ بناء الصور (قد يستغرق دقائق)…"
docker build -f deploy/console.Dockerfile -t naqla-console .
docker build -f deploy/backend.Dockerfile -t naqla-backend .

echo "▶ تشغيل الأساس: Caddy وPostgres وRedis ولوحة نقلة…"
"${COMPOSE[@]}" up -d caddy postgres redis console console-worker

# نسخة احتياطية يومية 03:15 بتوقيت مسقط (23:15 UTC) — آخر 14 نسخة لكل متجر في /opt/naqla/.backups
cat > /etc/cron.d/naqla <<CRON
15 23 * * * root /opt/naqla/deploy/naqla.sh backup-all daily >> /var/log/naqla-backup.log 2>&1
CRON

if [ "${1:-}" = "--update" ]; then
  for f in deploy/stores/*.compose.yml; do
    [ -e "$f" ] || continue
    slug="$(basename "$f" .compose.yml)"
    echo "▶ تحديث «${slug}»: نسخة احتياطية، ثم الخلفية (الترحيل) ثم الواجهة…"
    deploy/naqla.sh backup "$slug" pre-update
    deploy/naqla.sh migrate "$slug"
    deploy/naqla.sh storefront "$slug"
  done
fi

echo "✔ تم. التالي: deploy/naqla.sh console-admin <email> ثم deploy/naqla.sh store <slug>"
