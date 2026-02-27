# 58-02 Summary — Scoped Navigation Contract

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Added shared projecten workspace search builders:
  - `frontend/src/lib/navigation/workspaceSearch.ts`
- Extended projecten route search schema with province scope:
  - `frontend/src/routes/_authenticated/projecten.tsx`
  - Added `provincie_code` in URL state contract.
- Wired province scope into projecten navigation flows:
  - `frontend/src/components/projects/ProjectList.tsx`
  - Province selection now persists in URL search state.
  - Gemeente open/back actions now use shared workspace search builders.
- Hardened report detail back-navigation by source context:
  - `frontend/src/routes/_authenticated/rapport.$id.tsx`
  - Supports `from: rapporten | projecten | meldingen | resultaten`.
  - Falls back to browser history when source is absent.
- Standardized report-open source tagging across entry points:
  - `frontend/src/components/results/ParcelDetailModal.tsx` (`from: resultaten`)
  - `frontend/src/components/projects/WijkDetailView.tsx` (`from: projecten`)
  - `frontend/src/routes/_authenticated/meldingen.tsx` (`from: meldingen`)
  - `frontend/src/components/notifications/ChangeTimeline.tsx` (`from: projecten`)
  - `frontend/src/hooks/useReadTracking.ts` now accepts `reportSource` and propagates `from`.

## Verification

- `npm run -s typecheck` (frontend) ✅

## Notes

- This plan focuses on navigation/state contract hardening; data logic remains unchanged.
- Next execution target: `58-03-PLAN.md` (meldingen/rapporten operational UX under workspace scope).
