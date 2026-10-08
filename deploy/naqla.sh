#!/usr/bin/env bash
# أوامر تشغيل منصة نقلة على الخادم — تُنفَّذ داخل حاوية المنفّذ (تملك Docker والمسارات). القائمة: deploy/naqla.sh help
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose -p naqla --project-directory deploy -f deploy/docker-compose.yml exec -T console-worker node /opt/naqla/deploy/naqla.mjs "$@"
