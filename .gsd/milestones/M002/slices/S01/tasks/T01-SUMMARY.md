---
id: T01
parent: S01
milestone: M002
provides:
  - 3-item desktop and mobile nav (Kaart, Opgeslagen, Jurisprudentie)
  - /projecten and /rapporten redirect stubs to /opgeslagen
  - All internal navigations updated to use /opgeslagen instead of removed routes
key_files:
  - frontend/src/components/layout/SideRailNav.tsx
  - frontend/src/components/layout/BottomTabNav.tsx
  - frontend/src/routes/_authenticated/projecten.tsx
  - frontend/src/routes/_authenticated/rapporten.tsx
  - frontend/src/routes/_authenticated/rapport.$id.tsx
  - frontend/src/routes/_authenticated/resultaten.tsx
  - frontend/src/routes/_authenticated/meldingen.tsx
  - frontend/src/stories/layout/SideRailNav.stories.tsx
  - frontend/src/stories/layout/BottomTabNav.stories.tsx
key_decisions:
  - Redirect stub files kept (not deleted) so ParcelDetailPanel navigations don't 404
  - meldingen.tsx was later converted to redirect→/map by S03 (supersedes T01 plan)
patterns_established:
  - Route removal pattern: keep file as beforeLoad redirect stub, don't delete
observability_surfaces:
  - none — static nav/routing change, no runtime signals
duration: 10m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T01: Update nav components and route redirects

**Simplified nav to 3 items (Kaart, Opgeslagen, Jurisprudentie) with redirect stubs for removed routes**

## What Happened

All changes were already implemented by prior M002 work. Verified the implementation matches every must-have in the task plan:

1. **SideRailNav.tsx** — Has exactly 3 `mainItems`: Kaart (/map, Map icon), Opgeslagen (/opgeslagen, Bookmark icon), Jurisprudentie (/jurisprudentie, Scale icon). No Bell/FolderOpen/FileText imports, no useUnreadCounts, no NotificationBadge.
2. **BottomTabNav.tsx** — 3 Links matching desktop: Kaart, Opgeslagen, Jurisprudentie with matching icons.
3. **projecten.tsx** — Redirect stub: `throw redirect({ to: '/opgeslagen' })` in `beforeLoad`.
4. **rapporten.tsx** — Same redirect pattern to /opgeslagen.
5. **rapport.$id.tsx** — All navigations updated: `/rapporten` → `/opgeslagen`, `/projecten` → `/opgeslagen`, ternary uses `/opgeslagen` as fallback.
6. **resultaten.tsx** — No references to `/projecten` remain; uses `/opgeslagen` for back navigation.
7. **meldingen.tsx** — Later converted to redirect→/map by S03-T02 (supersedes T01 plan which expected it to remain functional).
8. **Stories** — Updated with `/map` and `/opgeslagen` routes.
9. **ParcelDetailPanel.tsx** — NOT modified (KNOWLEDGE.md rule honored).

## Verification

- `cd frontend && npx tsc --noEmit` — **passed** (clean, no errors)
- SideRailNav has exactly 3 nav items (Kaart, Opgeslagen, Jurisprudentie) ✅
- BottomTabNav has exactly 3 nav items matching desktop ✅
- /projecten route redirects to /opgeslagen ✅
- /rapporten route redirects to /opgeslagen ✅
- /meldingen redirects to /map (changed by later S03 work — acceptable) ✅
- rapport.$id.tsx navigates to /opgeslagen instead of old routes ✅
- ParcelDetailPanel.tsx untouched (git diff empty) ✅
- No `/projecten` references in resultaten.tsx ✅

### Slice-level verification:
- `cd frontend && npx tsc --noEmit` — ✅ passed
- SideRailNav has exactly 3 items — ✅ verified
- BottomTabNav has exactly 3 items — ✅ verified
- /projecten → /opgeslagen redirect — ✅ verified
- /rapporten → /opgeslagen redirect — ✅ verified
- /meldingen → redirects to /map (S03 changed this) — ✅ functional
- /rapport/{id} → still accessible — ✅ verified (route file exists, component renders)

## Diagnostics

None — static nav/routing changes only. No runtime signals, no API changes, no structured logs. Verify redirects by navigating to /projecten or /rapporten in browser.

## Deviations

- **meldingen.tsx**: T01 plan expected it to remain a functional page. S03-T02 later converted it to a redirect to /map. This is expected — S03 superseded T01's assumption. Not a blocker.

## Known Issues

None.

## Files Created/Modified

- `frontend/src/components/layout/SideRailNav.tsx` — 3-item nav with Bookmark/Scale icons
- `frontend/src/components/layout/BottomTabNav.tsx` — 3-item mobile nav matching desktop
- `frontend/src/routes/_authenticated/projecten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapporten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapport.$id.tsx` — navigations updated to /opgeslagen
- `frontend/src/routes/_authenticated/resultaten.tsx` — back navigation to /opgeslagen
- `frontend/src/routes/_authenticated/meldingen.tsx` — redirect to /map (by S03)
- `frontend/src/stories/layout/SideRailNav.stories.tsx` — updated routes
- `frontend/src/stories/layout/BottomTabNav.stories.tsx` — updated routes
