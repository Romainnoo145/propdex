#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Apply pending DB migrations before serving. With `set -e` a failed migration
# fails the deploy, so we never start the app against an out-of-date schema —
# the previous container keeps serving (Railway zero-downtime) until this one is
# healthy. Only the web service migrates; start_worker.sh must NOT, to avoid a
# concurrent-upgrade race. (alembic uses the asyncpg-normalized migration URL.)
echo "[start_web] alembic upgrade head"
alembic upgrade head

exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers
