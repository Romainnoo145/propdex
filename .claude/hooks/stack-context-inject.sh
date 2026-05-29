#!/usr/bin/env bash
# SessionStart hook — injects 3-laags stack kompas at session start.
#
# CONTEXT source = .planning/ + git (filesystem truth), NOT GSD STATE.md.
# Rationale (2026-05-29): GSD STATE.md only updates via /gsd:* commands and
# froze on 2026-05-17 at M050 pre-planning while three milestones' real work
# (M050 ship, M051 plan, M052/S01 ship) happened through .planning/ + git.
# The artifacts in .planning/phases/ + the git Mxxx/Sxx commit prefixes are
# the lived source of truth, so the kompas reads those directly.

set -euo pipefail

PROJ="/home/klarifai/Documents/klarifai/clientprojects/propdex"
PLANNING="$PROJ/.planning"
PHASES_DIR="$PLANNING/phases"
MILESTONES_DIR="$PLANNING/milestones"
SLICE_STATE_DIR="$(dirname "$0")/../state/slices"
mkdir -p "$SLICE_STATE_DIR"

cd "$PROJ"

# --- Active milestone + slice: latest Mxxx/Sxx commit prefix in git ---
MS_TAG=$(git log --oneline -80 2>/dev/null | grep -oE 'M0[0-9]+(\.[0-9]+)?/S[0-9]+' | head -1 || true)
if [[ -n "$MS_TAG" ]]; then
  MILESTONE="${MS_TAG%%/*}"   # e.g. M052
  SLICE="${MS_TAG##*/}"       # e.g. S01
else
  MILESTONE="(geen Mxxx/Sxx commit gevonden)"
  SLICE="-"
fi

ROADMAP="$MILESTONES_DIR/${MILESTONE}-ROADMAP.md"

# --- Locate the active phase dir for this slice (phase num == slice num) ---
SLICE_NUM=$(echo "$SLICE" | grep -oE '[0-9]+' || true)   # 01
PHASE_DIR=""
SLICE_STATUS="(geen phase-artefacten)"
NEXT_TAIL=""
if [[ -n "$SLICE_NUM" ]]; then
  PHASE_DIR=$(find "$PHASES_DIR" -maxdepth 1 -type d -name "${SLICE_NUM}-*" 2>/dev/null | sort | head -1 || true)
fi

if [[ -n "$PHASE_DIR" && -d "$PHASE_DIR" ]]; then
  TOTAL=$(find "$PHASE_DIR" -maxdepth 1 -name "${SLICE_NUM}-*-PLAN.md" 2>/dev/null | wc -l)
  DONE=0
  while IFS= read -r plan; do
    [[ -z "$plan" ]] && continue
    summary="${plan%-PLAN.md}-SUMMARY.md"
    [[ -f "$summary" ]] && DONE=$((DONE + 1))
  done < <(find "$PHASE_DIR" -maxdepth 1 -name "${SLICE_NUM}-*-PLAN.md" 2>/dev/null)

  VERIF="$PHASE_DIR/${SLICE_NUM}-VERIFICATION.md"
  if [[ -f "$VERIF" ]] && grep -qiE '^status:[[:space:]]*passed|^\*\*Status:\*\*[[:space:]]*passed' "$VERIF"; then
    SLICE_STATUS="✅ verified passed (${DONE}/${TOTAL} plans)"
    SLICE_COMPLETE=1
  elif [[ "$TOTAL" -gt 0 && "$DONE" -eq "$TOTAL" ]]; then
    SLICE_STATUS="plans klaar (${DONE}/${TOTAL}) · verificatie pending"
    SLICE_COMPLETE=0
  else
    SLICE_STATUS="in progress (${DONE}/${TOTAL} plans)"
    SLICE_COMPLETE=0
  fi
else
  SLICE_COMPLETE=0
fi

# --- Derive next action from roadmap slice ordering (titles reliable; checkboxes are NOT) ---
NEXT_ACTION="-"
if [[ -f "$ROADMAP" ]]; then
  # Build ordered "Sxx|Title" list from phase lines.
  mapfile -t SLICE_LINES < <(grep -E '^\- \[.\] \*\*Phase' "$ROADMAP" 2>/dev/null \
    | sed -E 's/^\- \[.\] \*\*([^*]+)\*\* \(M[0-9.]+\/(S[0-9]+)\).*/\2|\1/')

  CUR_IDX=-1
  for i in "${!SLICE_LINES[@]}"; do
    [[ "${SLICE_LINES[$i]%%|*}" == "$SLICE" ]] && CUR_IDX=$i && break
  done

  if [[ "$CUR_IDX" -ge 0 ]]; then
    CUR_TITLE="${SLICE_LINES[$CUR_IDX]#*|}"
    if [[ "$SLICE_COMPLETE" -eq 1 ]]; then
      NEXT_IDX=$((CUR_IDX + 1))
      if [[ "$NEXT_IDX" -lt "${#SLICE_LINES[@]}" ]]; then
        NEXT_SLICE="${SLICE_LINES[$NEXT_IDX]%%|*}"
        NEXT_TITLE="${SLICE_LINES[$NEXT_IDX]#*|}"
        NEXT_ACTION="${MILESTONE}/${SLICE} klaar. Volgende: ${MILESTONE}/${NEXT_SLICE} — ${NEXT_TITLE}. Per CLAUDE.md drie-laags: /plan-eng-review (+ /plan-design-review als UI-zwaar) vóór planning."
      else
        NEXT_ACTION="${MILESTONE}/${SLICE} klaar — laatste slice van ${MILESTONE}. Milestone afronden of nieuwe milestone scopen."
      fi
    else
      NEXT_ACTION="Vervolg ${MILESTONE}/${SLICE} — ${CUR_TITLE} (${SLICE_STATUS}). Roadmap: ${ROADMAP#$PROJ/}"
    fi
  else
    NEXT_ACTION="Slice ${SLICE} niet in ${ROADMAP#$PROJ/} gevonden — check roadmap-sync."
  fi
else
  NEXT_ACTION="Geen roadmap voor ${MILESTONE} in .planning/milestones/ — scope of hernoem."
fi

# --- Skills used in current slice (unchanged marker mechanism) ---
SLICE_KEY=$(echo "$MILESTONE $SLICE" | sed 's/[^a-zA-Z0-9]/_/g' | cut -c1-60)
SKILL_MARKER="$SLICE_STATE_DIR/${SLICE_KEY}.skills"
if [[ -f "$SKILL_MARKER" ]]; then
  USED_SKILLS=$(tr '\n' ',' < "$SKILL_MARKER" | sed 's/,$//' | sed 's/,/, /g')
else
  USED_SKILLS="(geen)"
fi

# --- Uncommitted files ---
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)

# --- Output context block ---
cat <<EOF
=== STACK KOMPAS ===
(bron: .planning/ + git — niet GSD STATE.md)

DECISION (gstack):  geen open beslissing — gstack alleen bij start nieuwe milestone
CONTEXT (.planning): milestone: $MILESTONE
                    slice:     $SLICE — $SLICE_STATUS
EXECUTION (sp):     skills used in slice: $USED_SKILLS

Next action:        $NEXT_ACTION
Uncommitted files:  $UNCOMMITTED

Triage-vraag: "Mis ik beslissing, context of executie?"
- Beslissing mist  → gstack (alleen nieuwe milestone)
- Context mist     → lees .planning/milestones/${MILESTONE}-ROADMAP.md + actieve phase-dir
- Executie mist    → kies superpowers skill (zie CLAUDE.md tabel)

Harde regels: commit met M0xx/Sxx prefix · brainstorm vóór nieuw component · verification vóór "klaar"
====================
EOF
