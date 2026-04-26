---
created: 2026-04-26T00:00:00.000Z
title: Phase 7 — values op 2 regels (geen truncate) zodra 6 cards/pagina
area: frontend/intelligence-grid
files:
  - frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
phase: M048/Phase-7
---

## Intent

In de huidige 3×3 grid (~150px usable per card) past `HERSTRUCTURERING` / `BESTEMMINGSPLAN` etc niet op 1 regel — vandaar `truncate` met hover-tooltip. Bij 6 cards/pagina (Phase 7) is elke card breder, en past het woord vaak ook in 1 regel óf netjes in 2.

User-feedback 2026-04-26: *"Wat fijn is, wat we nu nog niet hebben, maar als we straks wat meer ademruimte in de cards hebben omdat we maximaal 6 cards per page hebben — kunnen we de woorden misschien 2 regels geven zodat we niet alles hoeven te truncaten? Het woord volluit zegmaar."*

## Decision (Phase 7)

- Card-value: `line-clamp-2 break-words leading-[1.05]` ipv `truncate` — woorden mogen op 2 regels.
- Card-label + sub: kunnen op `truncate` blijven (kort genoeg meestal).
- Re-evaluate visueel in Phase 7 Storybook met 6-cards layout.

## Reference

- Phase 7 plan: `.planning/phases/07-factor-pinning-groep-pages-6-cards-per-page/`
- Office Hours decision (#21941, 2026-04-24): "6 cards per page, 1 group per page, synthetic pinned page 1 with ⭐"
- GROUP-02 requirement: category-based grouping + 6-cards/pagina pagination
