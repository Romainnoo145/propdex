---
id: S01
parent: M002
milestone: M002
provides:
  - 3-item nav (Kaart, Opgeslagen, Jurisprudentie) on desktop and mobile
  - /projecten and /rapporten redirect stubs → /opgeslagen
  - Clean route tree with no broken internal links
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
key_decisions:
  - Redirect stubs instead of route deletion — ParcelDetailPanel navigates to /rapporten and /projecten internally, and modifying it is forbidden per KNOWLEDGE.md
  - Internal navigations in rapport.$id, resultaten, meldingen updated to point directly to /opgeslagen rather than relying on redirect chains
patterns_established:
  - Redirect stub pattern for killed routes — keep route file, use beforeLoad + redirect(), add explanatory comment referencing why
observability_surfaces:
  - "npx tsc --noEmit in frontend/ — catches broken imports or stale route references"
  - "grep -r '/projecten\\|/rapporten' frontend/src/ — finds any remaining hardcoded references to old routes"
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T01-SUMMARY.md
duration: ~15min (single task)
verification_result: passed
completed_at: 2026-03-17
---

# S01: Nav Simplification

**Navigation collapsed from 5 items to 3 (Kaart, Opgeslagen, Jurisprudentie) on both desktop and mobile, with /projecten and /rapporten converted to redirect stubs pointing to /opgeslagen.**

## What Happened

Single task (T01) handled all changes since nav items, routes, and internal navigations are tightly coupled.

SideRailNav.tsx was trimmed from 5 nav items to 3, removing Projecten, Meldingen, and Rapporten entries along with the useUnreadCounts hook and NotificationBadge (the meldingen badge is gone from nav). BottomTabNav.tsx was updated to match — 3 items with Kaart, Opgeslagen (Bookmark icon), Jurisprudentie (Scale icon).

/projecten and /rapporten route files were converted to redirect stubs using TanStack Router's `beforeLoad` + `redirect({ to: '/opgeslagen' })` pattern. The route files were kept (not deleted) because ParcelDetailPanel.tsx navigates to these routes internally, and that component is never modified per KNOWLEDGE.md hard rules. The redirects catch those navigations cleanly.

Internal navigations in rapport.$id.tsx, resultaten.tsx, and meldingen.tsx were updated to point directly to /opgeslagen. Stories were updated to use /map as default route.

/meldingen route remains fully functional — just removed from nav. It will be killed in S03 when the feed moves into a gemeente modal.

## Verification

- `npx tsc --noEmit` — clean, zero errors
- SideRailNav: 3 items confirmed via code inspection (mainItems array)
- BottomTabNav: 3 links confirmed (grep shows exactly 3 `to:` props)
- projecten.tsx and rapporten.tsx are redirect stubs (beforeLoad + redirect pattern)
- /meldingen route file untouched
- ParcelDetailPanel.tsx NOT modified (KNOWLEDGE.md rule respected)

## Requirements Advanced

- No requirements directly map to S01 — this is structural groundwork enabling S02-S05

## Requirements Validated

- None

## New Requirements Surfaced

- None

## Requirements Invalidated or Re-scoped

- None

## Deviations

None. Execution matched plan exactly.

## Known Limitations

- components/projects/* (PortfolioView, DrilldownBreadcrumb, etc.) still navigate to /projecten internally — acceptable because those components only render behind the /projecten redirect stub. S05 will rebuild /opgeslagen with new components.
- ParcelDetailPanel.tsx navigates to /rapporten which hits the redirect. Functional but indirect — acceptable until a dedicated report navigation pattern is established.

## Follow-ups

- None — downstream slices (S02, S04, S05) are already planned to build on this foundation.

## Files Created/Modified

- `frontend/src/components/layout/SideRailNav.tsx` — 5→3 nav items, removed unread counts hook
- `frontend/src/components/layout/BottomTabNav.tsx` — 5→3 nav items, matching desktop
- `frontend/src/routes/_authenticated/projecten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapporten.tsx` — redirect stub → /opgeslagen
- `frontend/src/routes/_authenticated/rapport.$id.tsx` — navigations updated to /opgeslagen
- `frontend/src/routes/_authenticated/resultaten.tsx` — fallback navigate updated to /opgeslagen
- `frontend/src/routes/_authenticated/meldingen.tsx` — empty state CTA updated to /opgeslagen
- `frontend/src/stories/layout/SideRailNav.stories.tsx` — default route → /map
- `frontend/src/stories/layout/BottomTabNav.stories.tsx` — default route → /map

## Forward Intelligence

### What the next slice should know
- The 3-item nav is live. SideRailNav and BottomTabNav are simple arrays — adding/modifying items is straightforward.
- /opgeslagen route exists and is navigable but its page content is unchanged. S05 will rebuild it.
- /meldingen route works via direct URL but has no nav entry. S03 should delete it when embedding the feed in a gemeente modal.

### What's fragile
- Redirect stubs depend on ParcelDetailPanel.tsx not being modified — if anyone changes ParcelDetailPanel's navigate calls, the stubs become unnecessary. But the KNOWLEDGE.md rule prevents this, so it's stable.
- components/projects/* still reference /projecten — don't delete the redirect stub until S05 replaces those components.

### Authoritative diagnostics
- `npx tsc --noEmit` in frontend/ — catches any broken import or route reference immediately
- `grep -rn "to: '/projecten'" frontend/src/` — should return only the redirect stub and components/projects/* (which are behind the redirect). Any new hits indicate a missed update.
- `grep -c 'to:' frontend/src/components/layout/BottomTabNav.tsx` — should return exactly 3

### What assumptions changed
- No assumptions changed. The slice was low-risk as planned and executed cleanly.
