# Phase 08 — Deferred Items

## DEF-01 — fetchScanFlags endpoint URL alias  ✅ RESOLVED in Plan 08-05 (2026-05-19)

**Resolution:**
- Added `cascade_rescored_at: str | None` field to `ScanResultItem` schema
  (backend/app/scans/schemas.py)
- Propagated `flags.get("cascade_rescored_at")` from `ScanResult.flags` JSONB
  in `parcels_service.get_parcel_scan_data()` (backend/app/scans/parcels_service.py)
- Rewired `fetchScanFlags` to call `/api/scans/parcels/{parcelId}/scan-data`
  (frontend/src/hooks/useRescorePoll.ts)
- Extended `shouldStopOnSuccess` predicate to read top-level
  `cascade_rescored_at` (new shape) with legacy `flags.cascade_rescored_at`
  fallback for forward-compat
- Updated `useRescorePoll.test.ts` URL assertion + added 2 DEF-01 predicate tests
  (19/19 tests green, up from 17)

**Why backend change (not pure frontend):** ScanResultItem did NOT have a top-level
`flags` field — only individual extracted typed fields. The "single-line frontend
fix" path in original DEF-01 logging was based on incorrect assumption.

**Commit:** see Plan 08-05 final commits.

---

**Logged by:** Plan 08-03 (executor) on 2026-05-19
**Source:** Plan 08-02 SUMMARY open-issue + open-coordination note.

**Issue:**
`frontend/src/hooks/useRescorePoll.ts::fetchScanFlags` calls
`GET /api/parcels/{parcelId}/scan` which does NOT exist on the backend.
The real endpoint is `GET /api/scans/parcels/{parcelId}/scan-data`
(see `backend/app/scans/parcels_router.py` line 86).

**Why deferred from 08-03:**
Plan 08-03 is *component layer only* — `RescoreProgressBanner` consumes
`useRescorePoll` as a black box. Rewiring the endpoint touches the hook
layer (Plan 08-02 territory) AND requires verifying the response shape
includes `flags.cascade_rescored_at`. That belongs in either Plan 08-05
(router dispatch + endpoint wiring) or Plan 08-08 (E2E integration).

**Resolution paths (one of):**
(a) Update `fetchScanFlags` URL to `/api/scans/parcels/{parcelId}/scan-data`
    + ensure `ScanResultItem` response shape carries `flags` field.
(b) Add a thin alias route `GET /api/parcels/{parcel_id}/scan` in
    `backend/app/scans/parcels_router.py` that wraps `scan-data`.

**Recommendation:** Path (a) — single-line frontend fix; backend ScanResultItem
already returns a `flags` field per existing scan-data contract.

**Impact if unresolved:** Polling banner stays stuck in `polling` phase
forever (every poll 404s, transient-error branch silences them, MAX_TICKS=30
ticks → timeout banner displayed). No data corruption; user-facing
degradation = "Bijwerken duurt langer dan verwacht" copy.

**Owner:** Plan 08-05 or Plan 08-08 (whoever wires the actual scan endpoint
into the live polling cycle).
