---
created: 2026-04-20T14:00:00.000Z
title: Pre-M047 — Weights-principes vastleggen (Fase 1+2 van scoring-weights-recalibration)
area: scoring/governance
blocks: M047/S03
files:
  - backend/app/services/score_v3_factors.py
  - backend/app/services/score_v3.py
  - ~/.gstack/projects/Romainnoo145-propdex/existing-factors-audit-20260418.md
---

## Problem

M047/S03 voert de score-engine refactor uit voor extensibility + conditionele weights. Kan niet starten zonder principe-beslissing over:

- **Additief vs herverdelend?** Als M047 cascade-factor(en) toevoegt, wordt `_POTENTIE_MAX`/`_RISICO_MAX` groter, of schuiven bestaande weights omlaag? Dit bepaalt hoe backward-compat omgaat met pre-M047 scans.
- **Dekking-gewogen gewicht?** Factor met 5% dekking = lager effective weight dan factor met 95%?
- **Category-balans?** Mogen risico en potentie ongelijk wegen?
- **Conditional weights-model?** Per-projecttype gewichten als dict-op-factor vs aparte registry-metadata vs functor?

## Scope (wat hier wél)

- **Fase 1 — Retroactieve documentatie** (30-60 min): tabel met huidige 21 weights + categorie + dekking-% + active-vs-silent status. Input: `existing-factors-audit-20260418.md`.
- **Fase 2 — Herijking-principes vastleggen** (1-2 sessies): de 4 principe-vragen hierboven. Output = design-note `~/.gstack/projects/Romainnoo145-propdex/weights-principes-20260420.md` die M047/S03 als input krijgt.

## Out of scope (wat NIET)

- **Fase 3 — Implementatie** (config-extractie, drempel-kalibratie, percentiel-tuning): landt in **M048/S01** wanneer M047 cascade-factoren live zijn en we echte distributie kennen.

## Reason for blocker

M047/S03 (score-engine refactor) kan niet technisch kiezen tussen additief en herverdelend zonder expliciete principe-beslissing. Uitstellen veroorzaakt rework als de gemaakte keuze later moet wijzigen.

## When to start

Vóór `/gsd:plan-phase M047/S01`. Beslissing moet genomen zijn vóórdat S01 datamodel ontwerpt (projecttype → conditional-weights koppeling).

Reference: `.planning/todos/pending/2026-04-19-scoring-weights-recalibration.md` (origineel todo), `~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md` (Deel 4 §M047).
