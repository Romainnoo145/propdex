---
phase: 50-melding-to-map-flow
verified: 2026-02-23T05:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Click 'Bekijk op kaart' on a melding with matched_parcel_id, then click 'Genereer rapport' in the map popup"
    expected: "Map flies to parcel, amber popup opens automatically, clicking 'Genereer rapport' generates report and navigates to /rapport/<id>"
    why_human: "End-to-end flow requires live backend (parcel centroid endpoint) and real melding data with matched_parcel_id set"
  - test: "Open a melding with no matched_parcel_id but a valid address (postcode + huisnummer)"
    expected: "Address-based 'Bekijk op kaart' button appears instead of parcel-ID button"
    why_human: "Fallback branch requires data with null matched_parcel_id, cannot verify runtime rendering programmatically"
---

# Phase 50: Melding-to-Map Flow Verification Report

**Phase Goal:** A user who sees an interesting melding with a matched parcel can click once to fly to that parcel on the map, see an amber marker with address and action button, and generate a full report — the complete intelligence workflow in three clicks

**Verified:** 2026-02-23T05:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking 'Bekijk op kaart' on a change with matched_parcel_id opens the map and flies to the parcel location | VERIFIED | `meldingen.tsx` line 366-378: `{change.matched_parcel_id ? (<button onClick={() => onNavigate({ to: '/map', search: { parcel_id: change.matched_parcel_id! } })})` — map.tsx useEffect at line 430-452 fires on `urlParcelId`, calls `fetchParcelCentroid()` then `map.flyTo()` |
| 2 | An amber marker with address and 'Genereer rapport' button appears on the map without any extra clicks | VERIFIED | `addParcelMarker()` at map.tsx line 154-231 creates amber SVG pin with popup containing "Genereer rapport" button; `marker.togglePopup()` at line 228 opens popup immediately on creation |
| 3 | Clicking 'Genereer rapport' from the map marker navigates to a completed report using the geometrically verified parcel | VERIFIED | `addParcelMarker()` popup click handler at map.tsx line 211-224: calls `generateReportFromParcel(parcelId, accessToken)` then `navigateFn({ to: '/rapport/$id' })`; backend `POST /api/reports/from-parcel` exists at reports/router.py line 322 |
| 4 | If matched_parcel_id is null, the address-based 'Bekijk op kaart' fallback is still shown | VERIFIED | `meldingen.tsx` line 379-396: `} : canNavigateByAddress ? (<button onClick={() => onNavigate({ to: '/map', search: { postcode, huisnummer, _t } })})` — fallback branch intact; same pattern in `ChangeTimeline.tsx` line 281-298 using `canNav` |
| 5 | 'Genereer rapport' in both meldingen and ChangeTimeline uses matched_parcel_id when available | VERIFIED | `meldingen.tsx` line 399-406: `{change.matched_parcel_id ? (<button onClick={() => onGenerateReport(change.matched_parcel_id!)})` — `ChangeTimeline.tsx` line 301-308: `{change.matched_parcel_id ? (<button onClick={() => handleGenerateReport(change.matched_parcel_id!)})` |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/types/monitoring.ts` | ChangeRecord interface with matched_parcel_id field | VERIFIED | Line 30: `matched_parcel_id?: string \| null  // Phase 48 — geometrically verified via geocode + ST_Contains` — field placed after `postcode`, before `matched_parcels` as specified |
| `frontend/src/routes/_authenticated/meldingen.tsx` | Parcel-ID-based 'Bekijk op kaart' and 'Genereer rapport' buttons | VERIFIED | Lines 366-420: full conditional logic for both buttons; uses `change.matched_parcel_id` with fallback to address-based / `matched_parcels[]` list |
| `frontend/src/components/notifications/ChangeTimeline.tsx` | Consistent parcel-ID-based navigation in timeline view | VERIFIED | Lines 267-322: identical conditional pattern, adapted to local variable names (`canNav` vs `canNavigateByAddress`, `handleGenerateReport` vs `onGenerateReport`) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `meldingen.tsx` 'Bekijk op kaart' button | `/map?parcel_id=<matched_parcel_id>` | `onNavigate({ to: '/map', search: { parcel_id: change.matched_parcel_id! } })` | WIRED | Line 370-371 — exact pattern confirmed |
| `map.tsx` useEffect | `addParcelMarker()` | `fetchParcelCentroid` then `flyTo` then amber popup auto-open | WIRED | Lines 430-452 — `handledParcelRef` guard, `fetchParcelCentroid()`, `map.flyTo()`, `addParcelMarker()` all confirmed |
| `meldingen.tsx` 'Genereer rapport' button | `POST /api/reports/from-parcel` | `onGenerateReport(change.matched_parcel_id!)` → `generateReportFromParcel()` | WIRED | Line 401: `onClick={() => onGenerateReport(change.matched_parcel_id!)}` — `handleGenerateReport` (line 40-55) calls `generateReportFromParcel(parcelId, accessToken)` from lib/api.ts line 563 |

---

## Requirements Coverage

No requirements from REQUIREMENTS.md are explicitly mapped to Phase 50 (frontend wiring phase). Phase goal was to close the three-click intelligence workflow by wiring Phase 48 backend data through the frontend — all verified above.

---

## Anti-Patterns Found

None. No TODO/FIXME/placeholder comments in any modified file. No stub implementations. All handlers perform real API calls with error handling and loading states.

---

## Artifact Substantive Check

### monitoring.ts
- Field added at correct position (after `postcode`, before `matched_parcels`)
- Type is `string | null` with optional modifier (`?`) matching backend `str | None = None`
- Comment documents rationale

### meldingen.tsx
- Both buttons (Bekijk op kaart + Genereer rapport) use full conditional logic — not stubs
- Fallback branches preserved for null `matched_parcel_id`
- `generatingId` state tracks loading per parcel ID with `disabled` attribute and "Bezig..." text
- `handleGenerateReport` at line 40-55 performs real API call with try/catch/finally and toast on error

### ChangeTimeline.tsx
- Matches meldingen.tsx pattern exactly, adapted to local variable names
- `handleGenerateReport` at line 41-53 mirrors meldingen.tsx implementation
- `canNav` (line 199) is the local equivalent of `canNavigateByAddress`

### map.tsx (pre-existing, not modified in Phase 50)
- `addParcelMarker()` at line 154-231: substantive implementation with amber SVG, popup HTML, click handler, error handling, loading state
- `marker.togglePopup()` at line 228: popup auto-opens on marker creation (satisfies "without any extra clicks")
- `useEffect` at line 430-452: reads `urlParcelId`, guards against re-trigger, clears URL, calls real API, handles error

---

## TypeScript Build Check

`npm run check` completed with **0 errors** (143 pre-existing warnings, unchanged from prior phases as documented in SUMMARY).

---

## Human Verification Required

### 1. End-to-end three-click flow

**Test:** In a browser, navigate to /meldingen, expand a melding that has `matched_parcel_id` set (amber "1 perceel" badge visible), click "Bekijk op kaart" in the right action panel. Then click "Genereer rapport" in the amber map popup.
**Expected:** Map flies to parcel location at zoom 17, amber pin appears with popup auto-open showing parcel address and "Genereer rapport" button. Clicking "Genereer rapport" shows "Bezig..." state, then navigates to /rapport/<id>.
**Why human:** Requires live backend with real melding data that has `matched_parcel_id` set (depends on geocoding pipeline from Phase 48), map initialization, and multi-step navigation flow.

### 2. Null matched_parcel_id fallback

**Test:** In a browser, expand a melding where `matched_parcel_id` is null but `address` and `postcode` are set.
**Expected:** Address-based "Bekijk op kaart" button appears in the right panel (not a parcel-ID button). Clicking it navigates to the map with postcode+huisnummer search params.
**Why human:** Fallback branch requires production data with the specific null/address combination; cannot verify rendered branch programmatically.

---

## Commit Verification

All three task commits from SUMMARY exist in git log:
- `b7e5868` feat(50-01): add matched_parcel_id to ChangeRecord type
- `270ecfa` feat(50-01): wire matched_parcel_id in meldingen.tsx for map nav and report generation
- `5b36fac` feat(50-01): wire matched_parcel_id in ChangeTimeline.tsx for consistent nav and report generation

---

## Summary

Phase 50 goal is **fully achieved**. The three-click intelligence workflow is complete:

1. **Click 1** — "Bekijk op kaart" in meldingen expanded panel: navigates via `?parcel_id=<matched_parcel_id>` (Phase 48 geometrically verified UUID)
2. **Click 2** — Map flies to parcel, amber popup auto-opens with address and "Genereer rapport" button (pre-existing `addParcelMarker()` in map.tsx, unchanged)
3. **Click 3** — "Genereer rapport" in map popup: calls `POST /api/reports/from-parcel` with verified parcel ID, navigates to completed report

All three modified files have substantive, wired implementations. No stubs or placeholders. TypeScript passes with 0 errors. Fallback behavior preserved for null `matched_parcel_id`. ChangeTimeline.tsx applies identical logic for consistency across the wijk/gemeente detail view.

---

_Verified: 2026-02-23T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
