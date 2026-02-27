# 58-04 Summary — Canonical Parcel Map Workflow + Layer Model

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Unified map parcel interaction to one canonical flow:
  - `frontend/src/routes/_authenticated/map.tsx`
  - Removed legacy marker + popup fallback path (`focusedParcel` flow).
  - All route-driven parcel focus now resolves to the same yellow parcel highlight + `ParcelDetailModal` inspector path.
  - Cleared stale focus state across incoming map entry routes to prevent old parcel carry-over.

- Added extensible map layer catalog + persisted toggle preferences:
  - `frontend/src/lib/map/layers.ts`
  - Introduced centralized layer registry metadata for parcel overlays and boundary overlays.
  - Added localStorage-backed persisted map layer state (`propdex.map.layers.v1`).

- Refactored map layer toggle behavior to use persisted/canonical state:
  - `frontend/src/components/map/LayerToggle.tsx`
  - Hydrates from persisted layer state.
  - Persists updates for basemap, parcel visibility, gemeenten/bestemmingsplan/wijken, and parcel overlay mode.
  - Added explicit `Scangebied` toggle wiring.

- Added explicit scanned-scope boundary visibility control:
  - `frontend/src/routes/_authenticated/map.tsx`
  - Scanned wijk highlight can now be toggled on/off without removing other wijk context.

- Globalized parcel score fill layer id usage:
  - `frontend/src/components/map/ParcelScoreLayer.tsx`
  - `frontend/src/routes/_authenticated/map.tsx`
  - Exported and consumed `PARCEL_SCORE_FILL_LAYER_ID` to remove hardcoded layer-id strings.

- Removed obsolete styling tied to removed legacy popup:
  - `frontend/src/styles/index.css`

## Verification

- `npm run -s typecheck` (frontend) ✅

## Notes

- This phase is frontend-map workflow hardening only; no backend contract changes.
- Next execution target: `58-05-PLAN.md` (monitoring/report idempotency hardening + milestone verification handoff).
