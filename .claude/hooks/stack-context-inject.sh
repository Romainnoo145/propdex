#!/usr/bin/env bash
# SessionStart hook — injects 3-laags stack kompas at session start.
# Reads GSD STATE.md and active-skill marker, outputs a context block.

set -euo pipefail

GSD_STATE="/home/klarifai/.gsd/projects/0fbd70b53f1b/STATE.md"
SLICE_STATE_DIR="$(dirname "$0")/../state/slices"
mkdir -p "$SLICE_STATE_DIR"

# --- Parse GSD state ---
if [[ -f "$GSD_STATE" ]]; then
  MILESTONE=$(grep -m1 '^\*\*Active Milestone:\*\*' "$GSD_STATE" | sed 's/^\*\*Active Milestone:\*\* //')
  SLICE=$(grep -m1 '^\*\*Active Slice:\*\*' "$GSD_STATE" | sed 's/^\*\*Active Slice:\*\* //')
  PHASE=$(grep -m1 '^\*\*Phase:\*\*' "$GSD_STATE" | sed 's/^\*\*Phase:\*\* //')
  NEXT_ACTION=$(awk '/^## Next Action$/{flag=1; next} flag && /^[^#]/{print; exit}' "$GSD_STATE")
else
  MILESTONE="(GSD STATE.md niet gevonden)"
  SLICE="-"
  PHASE="-"
  NEXT_ACTION="-"
fi

# --- Check skills used in current slice ---
SLICE_KEY=$(echo "$MILESTONE $SLICE" | sed 's/[^a-zA-Z0-9]/_/g' | cut -c1-60)
SKILL_MARKER="$SLICE_STATE_DIR/${SLICE_KEY}.skills"
if [[ -f "$SKILL_MARKER" ]]; then
  USED_SKILLS=$(tr '\n' ',' < "$SKILL_MARKER" | sed 's/,$//' | sed 's/,/, /g')
else
  USED_SKILLS="(geen)"
fi

# --- Check uncommitted files ---
cd /home/klarifai/Documents/klarifai/clientprojects/propdex
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)

# --- Output context block ---
cat <<EOF
=== STACK KOMPAS ===

DECISION (gstack):  geen open beslissing — gstack alleen bij start nieuwe milestone
CONTEXT (GSD):      $MILESTONE
                    $SLICE
                    phase: $PHASE
EXECUTION (sp):     skills used in slice: $USED_SKILLS

Next action (GSD):  $NEXT_ACTION
Uncommitted files:  $UNCOMMITTED

Triage-vraag: "Mis ik beslissing, context of executie?"
- Beslissing mist  → gstack (alleen nieuwe milestone)
- Context mist     → lees STATE.md (hierboven al getoond)
- Executie mist    → kies superpowers skill (zie CLAUDE.md tabel)

Harde regels: commit met M0xx/Sxx prefix · brainstorm vóór nieuw component · verification vóór "klaar"
====================
EOF
