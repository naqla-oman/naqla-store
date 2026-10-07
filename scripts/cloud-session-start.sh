#!/usr/bin/env bash
# بدء جلسة Claude Code السحابية: يشغّل Postgres وRedis، ويجهّز apps/backend/.env للتطوير، ويثبّت الحزم.
# لا يعمل محلياً (CLAUDE_CODE_REMOTE=true في الجلسة السحابية فقط). لا أسرار هنا: قيم تطوير محلية فقط.
set -uo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

log() { echo "[cloud-start] $*"; }

# Postgres وRedis مثبّتان مسبقاً في الجلسة لكنهما متوقفان
service postgresql start >/dev/null 2>&1 || log "تعذّر تشغيل postgresql"
(redis-cli ping >/dev/null 2>&1) || service redis-server start >/dev/null 2>&1 || redis-server --daemonize yes --dir /tmp >/dev/null 2>&1
for _ in $(seq 1 20); do pg_isready -q && break; sleep 1; done

# مستخدم تطوير محلي (المتاجر تنشئ قواعدها naqla_<slug> بنفسها عبر store:setup)
su postgres -c "psql -tAc \"select 1 from pg_roles where rolname='naqla'\"" 2>/dev/null | grep -q 1 \
  || su postgres -c "psql -c \"create role naqla login superuser password 'naqla'\"" >/dev/null 2>&1 \
  || log "تعذّر إنشاء دور naqla"

# بيئة الخلفية للتطوير (مُتجاهلة في Git) — تُنشأ مرة واحدة فقط
if [ ! -f apps/backend/.env ]; then
  printf 'DATABASE_URL=postgres://naqla:naqla@localhost:5432/naqla\nREDIS_URL=redis://localhost:6379\n' > apps/backend/.env
  log "أُنشئ apps/backend/.env (تطوير)"
fi

# الحزم
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile >/tmp/cloud-pnpm-install.log 2>&1 && log "pnpm install ✓" || log "pnpm install فشل — راجع /tmp/cloud-pnpm-install.log"

log "جاهز: pnpm store:setup layan && pnpm store:setup demo-perfume عند الحاجة"
exit 0
