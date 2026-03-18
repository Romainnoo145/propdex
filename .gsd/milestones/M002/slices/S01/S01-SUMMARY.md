---
id: S01
parent: M002
milestone: M002
provides:
  - 3-item desktop nav (Kaart, Opgeslagen, Jurisprudentie) via SideRailNav
  - 3-item mobile nav matching desktop via BottomTabNav
  - /projecten redirect stub → /opgeslagen
  - /rapporten redirect stub → /opgeslagen
  - All internal navigations updated from removed routes to /opgeslagen
  - /meldingen route removed from nav (later converted to redirect by S03)
requires: []
affects:
  - S02
  - S04
  - S05
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
  - Redirect stub files kept (not deleted) so ParcelDetailPanel navigations hit redirects instead of 404
  - Meldingen route kept alive initially but removed from nav — S03 later converted it to redirect→/map
  - Bookmark icon chosen for Opgeslagen nav item (semantic match for saved/favorited parcels)
patterns_established:
  - Route removal pattern: keep file as beforeLoad redirect stub, never delete — ensures internal navigations degrade gracefully
observability_surfaces:
  - none — static nav/routing changes only, no runtime signals or API changes
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T01-SUMMARY.md
duration: 10m
verification_result: passed
completed_at: 2026-03-17
---

# S01: Nav Simplification

**Navigation collapsed to 3 items (Kaart, Opgeslagen, Jurisprudentie) on desktop and mobile, with redirect stubs preserving old route navigations**

## What Happened

Single task (T01) simplified the entire navigation surface. SideRailNav's `mainItems` array was reduced to 3 entries: Kaart (/map, Map icon), Opgeslagen (/opgeslagen, Bookmark icon), Jurisprudentie (/jurisprudentie, Scale icon). BottomTabNav was updated to match with the same 3 links. The `useUnreadCounts` hook and `NotificationBadge` import were removed from nav (meldingen badge gone).

For removed routes, projecten.tsx and rapporten.tsx were rewritten as redirect stubs using TanStack Router's `beforeLoad` → `throw redirect({ to: '/opgeslagen' })`. The files were intentionally kept (not deleted) because ParcelDetailPanel.tsx navigates to these routes and cannot be modified per KNOWLEDGE.md hard rules.

All internal navigations in rapport.$id.tsx, resultaten.tsx, and meldingen.tsx were updated to use /opgeslagen instead of /projecten or /rapporten. The meldingen route was initially left functional (just removed from nav), then later converted to a redirect→/map by S03-T02 work.

Stories for both nav components were updated with /map and /opgeslagen routes.

## Verification

- `cd frontend && npx tsc --noEmit` — **passed** (zero errors)
- SideRailNav renders exactly 3 nav items (Kaart, Opgeslagen, Jurisprudentie) ✅
- BottomTabNav renders exactly 3 nav items matching desktop ✅
- /projecten route has `beforeLoad` redirect to /opgeslagen ✅
- /rapporten route has `beforeLoad` redirect to /opgeslagen ✅
- rapport.$id.tsx navigates to /opgeslagen (no references to /projecten or /rapporten) ✅
- resultaten.tsx navigates to /opgeslagen (no references to /projecten) ✅
- ParcelDetailPanel.tsx untouched (KNOWLEDGE.md rule honored) ✅
- No TypeScript errors anywhere in frontend ✅

## Requirements Advanced

- None directly — S01 is structural nav work, not feature delivery

## Requirements Validated

- None

## New Requirements Surfaced

- None

## Requirements Invalidated or Re-scoped

- None

## Deviations

- **meldingen.tsx**: T01 plan expected the route to remain a functional page with only the nav link removed. S03-T02 later converted it to a redirect→/map. This is expected — S03 superseded T01's assumption. Not a regression.

## Known Limitations

- ParcelDetailPanel.tsx still navigates to /rapporten internally — this hits the redirect stub and works, but is technically an extra client-side redirect hop. Acceptable since ParcelDetailPanel cannot be modified.

## Follow-ups

- None — all nav simplification work is complete.

## Files Created/Modified

- `frontend/src/components/layout/SideRailNav.tsx` — 3-item nav with Map/Bookmark/Scale icons
- `frontend/src/components/layout/BottomTabNav.tsx` — 3-item mobile nav matching desktop
- `frontend/src/routes/_authenticated/projecten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapporten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapport.$id.tsx` — navigations updated to /opgeslagen
- `frontend/src/routes/_authenticated/resultaten.tsx` — back navigation to /opgeslagen
- `frontend/src/routes/_authenticated/meldingen.tsx` — redirect to /map (by S03)
- `frontend/src/stories/layout/SideRailNav.stories.tsx` — updated default routes
- `frontend/src/stories/layout/BottomTabNav.stories.tsx` — updated default routes

## Forward Intelligence

### What the next slice should know
- The route tree is clean: 3 nav items, redirect stubs for old routes. No broken links exist. S02/S04/S05 can build on this without worrying about stale navigation references.
- The redirect stub pattern (`beforeLoad` → `throw redirect()`) is proven and should be reused if more routes are killed in future slices.

### What's fragile
- ParcelDetailPanel.tsx navigates to /rapporten which hits a redirect stub — if the stub file is accidentally deleted, that navigation will 404. The stub must persist as long as ParcelDetailPanel exists unchanged.

### Authoritative diagnostics
- `cd frontend && npx tsc --noEmit` — the single authoritative check. Zero errors means nav/route changes are consistent. If this fails after downstream changes, check routeTree.gen.ts first.
- `grep -r '/projecten\|/rapporten' frontend/src/components/ frontend/src/routes/` — should return only the redirect stub files. Any other hits indicate a missed navigation update.

### What assumptions changed
- Original plan assumed /meldingen would stay as a functional page through S01. In practice, S03 work ran concurrently and converted meldingen.tsx to a redirect→/map. This is fine — the nav simplification goal is fully met either way.
