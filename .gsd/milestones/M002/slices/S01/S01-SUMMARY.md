---
id: S01
parent: M002
milestone: M002
provides:
  - 3-item SideRailNav (Kaart, Opgeslagen, Jurisprudentie) on desktop
  - 3-item BottomTabNav matching desktop on mobile
  - /projecten and /rapporten redirect stubs to /opgeslagen
  - All internal navigations updated away from removed routes
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
  - Redirect stubs kept instead of deleting route files — ParcelDetailPanel navigates to /rapporten internally and cannot be modified per KNOWLEDGE.md hard rule
patterns_established:
  - Route removal pattern — keep file as beforeLoad redirect stub rather than deleting, to catch internal navigations from untouchable components
observability_surfaces:
  - none — static nav/routing change with no runtime signals
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T01-SUMMARY.md
duration: 10m
verification_result: passed
completed_at: 2026-03-17
---

# S01: Nav Simplification

**Navigation collapsed from 5 items to 3 (Kaart, Opgeslagen, Jurisprudentie) on desktop and mobile, with redirect stubs for removed routes.**

## What Happened

Single task (T01) covered all changes since nav items, routes, and internal navigations are tightly coupled.

**SideRailNav.tsx** was reduced from 5 nav items to 3: Kaart (/map), Opgeslagen (/opgeslagen, Bookmark icon), Jurisprudentie (/jurisprudentie, Scale icon). Removed useUnreadCounts hook, NotificationBadge import, and Bell/FolderOpen/FileText icons. **BottomTabNav.tsx** was updated to match — same 3 items with the same icons.

**projecten.tsx** and **rapporten.tsx** were rewritten as redirect stubs using `beforeLoad` with `throw redirect({ to: '/opgeslagen' })`. Files were kept alive (not deleted) because ParcelDetailPanel.tsx navigates to /rapporten internally and cannot be modified per the KNOWLEDGE.md hard rule.

**rapport.$id.tsx** had 3 navigate calls and 2 back labels updated from /rapporten and /projecten to /opgeslagen. **resultaten.tsx** had its fallback navigate changed from /projecten to /opgeslagen. **meldingen.tsx** had its empty state CTA updated from "Naar projecten" to "Naar opgeslagen". Stories for both nav components were updated to use /map and /opgeslagen routes.

## Verification

- `npx tsc --noEmit` — clean, no TypeScript errors
- SideRailNav confirmed showing exactly 3 items (Kaart, Opgeslagen, Jurisprudentie)
- BottomTabNav confirmed showing exactly 3 items matching desktop
- /projecten and /rapporten route files exist as redirect stubs → /opgeslagen
- /meldingen route file intact (accessible via direct URL until S03 kills it)
- rapport.$id.tsx route file intact (individual report view still accessible)
- ParcelDetailPanel.tsx NOT modified (KNOWLEDGE.md hard rule respected)

## Requirements Advanced

- none — S01 is structural nav cleanup, not mapped to specific requirements

## Requirements Validated

- none

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

None — all plan items executed as specified.

## Known Limitations

- ParcelDetailPanel.tsx still navigates to /rapporten which hits the redirect stub. Acceptable but slightly janky — a user navigating from parcel detail to "reports" ends up at /opgeslagen.
- components/projects/* (PortfolioView, DrilldownBreadcrumb, etc.) still reference /projecten internally. These components render behind the /projecten redirect so they're unreachable, but the dead code remains until S05 rebuilds /opgeslagen.

## Follow-ups

- S05 will rebuild /opgeslagen with new components, which can clean up dead code in components/projects/*.
- S03 will kill the /meldingen route entirely.

## Files Created/Modified

- `frontend/src/components/layout/SideRailNav.tsx` — 3-item nav with Bookmark/Scale icons
- `frontend/src/components/layout/BottomTabNav.tsx` — 3-item mobile nav matching desktop
- `frontend/src/routes/_authenticated/projecten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapporten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapport.$id.tsx` — navigations updated to /opgeslagen
- `frontend/src/routes/_authenticated/resultaten.tsx` — back navigation to /opgeslagen
- `frontend/src/routes/_authenticated/meldingen.tsx` — empty state CTA updated
- `frontend/src/stories/layout/SideRailNav.stories.tsx` — updated default route
- `frontend/src/stories/layout/BottomTabNav.stories.tsx` — updated default route

## Forward Intelligence

### What the next slice should know
- The route structure is clean: 3 nav items, 2 redirect stubs, all internal navigations point to /opgeslagen. S02 can add the GemeenteContextPanel without worrying about stale nav links.
- The redirect stub pattern (keep file, use beforeLoad redirect) is the established way to remove routes in this codebase.

### What's fragile
- ParcelDetailPanel.tsx navigates to /rapporten which hits the redirect — this works but is an indirect path. If someone removes the rapporten.tsx stub file, parcel detail navigation breaks.

### Authoritative diagnostics
- `npx tsc --noEmit` in frontend/ — the definitive contract check for route/import integrity
- SideRailNav.tsx `mainItems` array — single source of truth for desktop nav items
- BottomTabNav.tsx Links — single source of truth for mobile nav items

### What assumptions changed
- No assumptions changed — S01 executed as planned with no surprises.
