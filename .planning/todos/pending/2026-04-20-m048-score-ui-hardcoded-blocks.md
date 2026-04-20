---
created: 2026-04-20T14:30:00.000Z
title: M048 — Hardcoded 60/40 weight-blocks in ScoreBreakdownModal + ×{gewicht} raw label
area: frontend/scoring-ui
files:
  - frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx
---

## Problem

**Twee bugs in `ScoreBreakdownModal.tsx` die opspelen zodra M047 S03 de backend-weights refactored:**

1. **Hardcoded weight-distribution blocks (regel 233-256):** "60%" en "40%" staan als string-literals in de JSX. Niet gekoppeld aan `potentie_risico_balance` in backend (die staat op 0.7 = 70/30). Reason unknown — mogelijk ingecheckt voor demo-screenshots, nooit opgeschoond.

2. **`×{factor.gewicht}` raw integer label (regel 394):** toont multiplier-notatie `×12`, `×13`, `×18` naast elke factor. Geeft user geen info — raw integer van `_POTENTIE_MAX = 80` / `_RISICO_MAX = 87` systeem. User: *"Er staat x18 en dat soort dingen. Dat moet toch makkelijker kunnen?"*

## Fix

**Post-M047 (landt in M048 Score v4.0 Frontend Scaling):**

1. **Weight-blocks dynamisch:** lees balance uit backend payload (nieuwe veld `potentie_risico_balance` op `ScoreV3Result`, default 0.7 → display "70%" / "30%"). Design-keuze: laten staan of helemaal weghalen bij M048-redesign.

2. **`×{gewicht}` vervangen:**
   - Backend M047/S03 exposeert nieuw veld `percentage_of_category` per factor (sommeert naar 100 per categorie na M047-refactor).
   - Frontend toont één van: progress-bar-width impliciet (geen label) / `{weight}pt` tag in expanded detail / niets op collapsed view.
   - **Nooit meer raw integer zonder context.**

## Why blocked until M048

Backend-refactor in M047/S03 is prereq — pas dan sommeren weights netjes naar 100 per categorie en is er een logisch `percentage_of_category` veld. M047 POC-factor (`woonvisie_match`) landt visueel nog in bestaande `ScoreBreakdownModal` zonder UI-redesign; echte herontwerp in M048.

## Locked decisions (2026-04-20 pre-M047 weights-principes discussie)

- **Additief → herverdelend:** per categorie 100 punten vast, nieuwe factor = expliciete weight-shift op bestaande.
- **Category-balans:** `potentie_risico_balance = 0.7` blijft. Developer-upside; zonder bias komen scores nooit in 70+ range.
- **Dekking-gewogen weight:** niet ingevoerd; runtime `_redistribute_missing_weights` blijft (silent-neutral factoren worden apart geaudit in Fase 1).
- **Data-contract:** backend voegt `percentage_of_category` toe (houdt `gewicht` voor backward-compat).
- **Projecttype-gebonden balance (option C uit discussie):** bewaard voor M050+ als er data is om claimen dat specifieke projecttypen systematisch uit het ideaal lopen.

Reference: `.planning/todos/pending/2026-04-20-m047-pre-weights-principes.md` (Fase 1+2 werk), `~/.gsd/projects/0fbd70b53f1b/milestones/M047/M047-ROADMAP.md` (S03 score-engine refactor).
