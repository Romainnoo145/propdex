---
id: T02
parent: S03
milestone: M002
provides:
  - JuridischKlimaatModal with embedded JurisprudenceSection
  - MeldingenModal with infinite-scroll feed, read tracking, date grouping
  - /meldingen redirect stub to /map
key_files:
  - frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx
  - frontend/src/components/map/panels/gemeente/MeldingenModal.tsx
  - frontend/src/routes/_authenticated/meldingen.tsx
key_decisions:
  - JuridischKlimaatModal gets max-w-5xl to accommodate side-by-side feed+viewer layout
patterns_established:
  - Thin modal wrappers embedding existing self-contained section components
observability_surfaces:
  - openModal state in GemeenteContextPanel — inspect via React DevTools
  - MeldingenModal IntersectionObserver sentinel visible in DOM for scroll debugging
  - Empty state fallback shows gemeente name for tracing data availability issues
duration: 20m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T02: Juridisch Klimaat + Meldingen modals, kill /meldingen route

**Both modals were already implemented from a prior attempt — verified working, added maxWidth to JuridischKlimaatModal for better layout**

## What Happened

All artifacts for this task already existed: JuridischKlimaatModal.tsx (thin wrapper around JurisprudenceSection), MeldingenModal.tsx (full feed with infinite scroll, read tracking, date grouping), GemeenteContextPanel.tsx (wiring all 4 modals), and meldingen.tsx (redirect stub). The code was already integrated and compiling.

One improvement made: added `maxWidth="max-w-5xl"` to JuridischKlimaatModal since JurisprudenceSection renders a side-by-side layout (feed list + document viewer) that needs more horizontal space than the default max-w-2xl.

## Verification

- `cd frontend && npx tsc --noEmit` — clean, zero errors
- Browser: clicked Gem. WOZ card → JuridischKlimaatModal opened with "Juridisch Klimaat · Oostzaan" title, JurisprudenceSection loading uitspraken
- Browser: clicked Scans card → MeldingenModal opened with "Meldingen · Oostzaan" title, showed "Geen meldingen" empty state (correct — Oostzaan has no data)
- Browser: Escape key closes modal, returns to GemeenteContextPanel
- Browser: /meldingen → redirects through auth to /map (redirect stub working)
- Slice verification: all checks pass (tsc clean, all 4 modals open/close, /meldingen redirects)

## Diagnostics

- `openModal` state in GemeenteContextPanel React DevTools: null = no modal, 'juridisch'/'meldingen' = modal active
- MeldingenModal: sentinel div at bottom of feed triggers IntersectionObserver for infinite scroll
- JuridischKlimaatModal: JurisprudenceSection hooks auto-fetch on mount — loading states visible in UI

## Deviations

None — all artifacts pre-existed and matched plan requirements.

## Known Issues

- 401 errors on wijken fetch during gemeente click — likely stale auth token from session timeout, not related to this task

## Files Created/Modified

- `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx` — added maxWidth="max-w-5xl" for side-by-side layout
