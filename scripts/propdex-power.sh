#!/usr/bin/env bash
# propdex-power.sh — park/wek de propdex Railway-services om memory-kosten te sparen.
#
# propdex is in de bouwfase: geen users, hoeft niet 24/7 te draaien.
# Park 'm als je klaar bent voor de dag (memory-billing → ~0), wek 'm als je gaat werken.
#
#   ./scripts/propdex-power.sh up       # alles aan — DB eerst, dan api+worker. Triggert builds (~paar min).
#   ./scripts/propdex-power.sh down     # alles parkeren. Data blijft op de Railway-volumes staan.
#   ./scripts/propdex-power.sh status   # huidige memory per service
#
# Mechaniek: `railway down` haalt de draaiende deployment weg (geen compute = geen billing).
# `railway redeploy --from-source` haalt de laatste commit/image en deployt opnieuw.
# De DB-data leeft op een persistente volume en overleeft het parkeren — alleen committed
# code wordt bij `up` gedeployd (push je werk dus eerst als je dat live wilt).
set -uo pipefail

PROJECT="697203e0-b4ea-4b8b-946e-6c817a542d39"   # propdex-staging
ENV="production"
DATA=("PostGIS" "Redis")   # bij UP eerst aan, bij DOWN als laatste uit
APP=("api" "worker")       # bij UP als laatste aan, bij DOWN eerst uit

case "${1:-status}" in
  up)
    echo "↑ propdex wekken (builds duren ~paar minuten)…"
    for s in "${DATA[@]}" "${APP[@]}"; do
      echo "  • $s"
      railway redeploy --from-source -s "$s" -p "$PROJECT" -e "$ENV" -y >/dev/null 2>&1 \
        || echo "    ⚠ $s: redeploy gaf een fout — check het dashboard"
    done
    echo "✓ Onderweg. Volg met: $0 status   (geef de DB ~30s)"
    ;;
  down)
    echo "↓ propdex parkeren (data blijft op de volumes staan)…"
    for s in "${APP[@]}" "${DATA[@]}"; do
      echo "  • $s"
      railway down -s "$s" -p "$PROJECT" -e "$ENV" -y >/dev/null 2>&1 \
        || echo "    ⚠ $s: down gaf een fout — check het dashboard"
    done
    echo "✓ Geparkeerd. Memory-billing ~0 tot je '$0 up' draait."
    ;;
  status)
    echo "propdex memory per service:"
    railway metrics -p "$PROJECT" -e "$ENV" --all --memory 2>/dev/null \
      | grep -E "MB|GB" | grep -v "─" \
      || echo "  (geen draaiende services / geen data — waarschijnlijk geparkeerd)"
    ;;
  *)
    echo "Usage: $0 up|down|status"; exit 1;;
esac
