# 58-03 Summary — Operational UX Under Workspace Scope

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Added route-level scope state for Meldingen:
  - `frontend/src/routes/_authenticated/meldingen.tsx`
  - Introduced validated `gemeente` search param.
  - Gemeente filter now writes to URL state and can be cleared via compact scope chip.

- Added route-level scope state for Rapporten:
  - `frontend/src/routes/_authenticated/rapporten.tsx`
  - Introduced validated `project_id` and `q` search params.
  - Project filter + query are URL-driven for shareable/recoverable list state.
  - Added compact active-scope chip with quick clear action.

- Simplified desktop Meldingen detail panel (reduced noise):
  - `frontend/src/routes/_authenticated/meldingen.tsx`
  - Removed low-value postcode/huisnummer/matchstatus meta block.
  - Removed duplicated bottom CTA row.
  - Moved high-value actions into a compact action block:
    - `Sla op in project +`
    - `Bekijk officiële publicatie`

- Standardized search input behavior for scan results:
  - `frontend/src/routes/_authenticated/resultaten.tsx`
  - Replaced ad-hoc search input with shared `SearchInput` primitive for consistent anti-autofill behavior.

- Navigation contract alignment for routes with required search schema:
  - `frontend/src/components/layout/SideRailNav.tsx`
  - `frontend/src/components/layout/BottomTabNav.tsx`
  - `frontend/src/routes/_authenticated/rapport.$id.tsx`

## Verification

- `npm run -s typecheck` (frontend) ✅

## Notes

- This phase focused on operational clarity and scope persistence, not data-model changes.
- Next execution target: `58-04-PLAN.md` (canonical parcel map workflow + layer model).
