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

# متصفح Playwright لاختبارات test:i18n (بايثون): الحاوية فيها متصفح مثبّت مسبقاً في PLAYWRIGHT_BROWSERS_PATH
# قد لا يطابق نسخة حزمة بايثون. الترتيب: يعمل كما هو ← playwright install chromium (سريع إن كان مثبّتاً)
# ← إن منعت الشبكة cdn.playwright.dev: نثبّت من PyPI نسخة بايثون التي تطابق مراجعة المتصفح الموجود.
pw_ok() { timeout 90 python3 -c "
import asyncio
from playwright.async_api import async_playwright
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(); await b.close()
asyncio.run(m())" >/dev/null 2>&1; }
pw_ver() { python3 -c "import importlib.metadata as m; print(m.version('playwright'))" 2>/dev/null; }
if python3 -c "import playwright" >/dev/null 2>&1; then
  if pw_ok; then
    log "playwright $(pw_ver) ✓"
  else
    python3 -m playwright install chromium >/tmp/cloud-playwright.log 2>&1 || true
    if ! pw_ok; then
      # نسخة playwright-core (Node) المثبّتة مع المتصفح نفسه تحدد النسخة المطابقة (1.56.1 ← 1.56.x في PyPI)
      bp="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
      for bj in $(find /opt /usr/local/lib /usr/lib -path '*playwright-core/browsers.json' 2>/dev/null); do
        rev=$(node -p "require('$bj').browsers.find(b=>b.name==='chromium').revision" 2>/dev/null)
        [ -n "$rev" ] && [ -d "$bp/chromium-$rev" ] || continue
        mm=$(node -p "require('$(dirname "$bj")/package.json').version.split('.').slice(0,2).join('.')" 2>/dev/null)
        pip install -q --break-system-packages "playwright~=$mm.0" >>/tmp/cloud-playwright.log 2>&1 && pw_ok && break
      done
    fi
    pw_ok && log "playwright $(pw_ver) ✓ (متصفح مطابق)" || log "playwright: لا متصفح مطابق — راجع /tmp/cloud-playwright.log"
  fi
fi

log "جاهز: pnpm store:setup <slug> لكل متجر في clients/ عند الحاجة"
exit 0
