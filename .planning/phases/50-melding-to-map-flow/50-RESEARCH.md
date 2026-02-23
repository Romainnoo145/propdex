# Phase 50: Melding-to-Map Flow — Research

**Researched:** 2026-02-23
**Domain:** Frontend navigation + map marker + report generation from verified parcel data
**Confidence:** HIGH — all findings are based on the actual codebase, no external library research required

---

## Summary

Phase 50 closes the "three-click intelligence workflow": melding → map → report. The goal is to let a user click "Bekijk op kaart" on a matched melding, fly the map to the parcel, see an amber popup with a "Genereer rapport" button, and generate a report using the verified `matched_parcel_id` — all without manual project setup.

**The good news: this phase is almost entirely already implemented.** The map route (`map.tsx`) already has a complete `addParcelMarker()` function and a `useEffect` that handles standalone `parcel_id` URL params. The meldingen route already navigates to `/map?parcel_id=...` for matched parcels. The backend `POST /api/reports/from-parcel` already handles report generation and wijk project auto-creation. The centroid endpoint already returns `{ lng, lat, address }`.

**The gap:** The "Bekijk op kaart" button in `meldingen.tsx` navigates using `m.parcel_id` (the ParcelCache UUID), but the monitoring API's `MatchedParcel` shape only surfaces parcels matched via postcode (`find_matching_parcels`). Phase 48 stores `matched_parcel_id` directly on `ChangeRecord` and exposes it as `ChangeRecordResponse.matched_parcel_id`. This direct field (one parcel per change record, geometrically verified via geocode + ST_Contains) is the authoritative match — **but the meldingen UI ignores it**. The success criteria say "Genereer rapport uses the verified parcel ID from the ChangeRecord", meaning `matched_parcel_id`, not the postcode-matched `matched_parcels` list.

**Primary recommendation:** Phase 50 is a surgical integration task. Use `change.matched_parcel_id` (from the Phase 48 field on `ChangeRecordResponse`) as the primary navigation target for "Bekijk op kaart", and wire the map marker's "Genereer rapport" to call `POST /api/reports/from-parcel` with that verified ID. The backend wijk auto-create is already complete; no backend changes are needed.

---

## Standard Stack

### Core (already in use — no new dependencies)

| Library | Purpose | Notes |
|---------|---------|-------|
| `@tanstack/react-router` | `useNavigate`, search params passing | `MapSearchParams.parcel_id` already defined |
| `maplibregl` | `Marker`, `Popup`, `flyTo` | `addParcelMarker()` already implemented in `map.tsx` |
| `sonner` (toast) | Error feedback | Already used in map and meldingen |
| `generateReportFromParcel` in `lib/api.ts` | `POST /api/reports/from-parcel` | Already implemented |
| `fetchParcelCentroid` in `lib/api.ts` | `GET /api/scans/parcels/{id}/centroid` | Already implemented |

### No new installations needed

```bash
# Nothing to install — all required libraries are already present
```

---

## Architecture Patterns

### What Already Works (verified in codebase)

#### 1. Map route: `parcel_id` search param handling

**File:** `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/routes/_authenticated/map.tsx`

The `MapSearchParams` interface already defines `parcel_id?: string` (line 67).

The `validateSearch` already parses it (line 83).

There is already a dedicated `useEffect` (starting at line 429) that:
- Fires when `urlParcelId` is set and `urlScanId` is NOT set (standalone parcel from meldingen)
- Calls `fetchParcelCentroid(pid, accessToken)`
- Calls `map.flyTo({ center: lngLat, zoom: 17, duration: 1200 })`
- Calls `addParcelMarker(map, lngLat, address, pid, accessToken, navigate, reportMarkerRef)`

The `addParcelMarker()` function (line 154) already:
- Creates an amber SVG pin element
- Creates a `maplibregl.Popup` with the address and a "Genereer rapport" button
- On popup open, attaches a click handler that calls `generateReportFromParcel(parcelId, accessToken)` and navigates to the report
- Calls `marker.togglePopup()` immediately so the popup is visible without any extra click

#### 2. Backend: report from parcel with wijk auto-create

**File:** `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/reports/router.py`

`POST /api/reports/from-parcel` (line 322) already:
- Fetches ParcelCache by `parcel_id` with org isolation
- Parses the address to `(postcode, huisnummer)`
- Runs `aggregate_property_data()` (full BAG/PDOK/DSO/RCE pipeline)
- Auto-derives `project_id` from the parcel's scan link
- If no project exists, calls `_find_or_create_wijk_project()` (line 76) to auto-create gemeente + wijk hierarchy
- Returns `ReportDetailResponse`

#### 3. Frontend API: `generateReportFromParcel`

**File:** `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/lib/api.ts` (line 563)

Already implemented as `POST /api/reports/from-parcel` with `{ parcel_id }` body.

#### 4. Centroid endpoint

**File:** `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/scans/router.py` (line 464)

`GET /api/scans/parcels/{parcel_id}/centroid` already returns `{ lng, lat, address }`.

---

### The Gap: Which parcel_id reaches the map?

#### Current meldingen behavior

In `meldingen.tsx`, the "Bekijk op kaart" button for matched parcels navigates:

```typescript
// meldingen.tsx line 311-315 — current behavior (matched_parcels list)
onNavigate({
  to: '/map',
  search: { parcel_id: m.parcel_id },
})
```

This uses `change.matched_parcels[]` (postcode-matched, populated by `find_matching_parcels()` when `include_matches=true`). These are returned when `meldingen.tsx` calls `useAllChanges(true)` — the `true` enables `include_matches`.

There is also a separate "Bekijk op kaart" button at lines 366-383 that navigates using `postcode + huisnummer` (address-based, not parcel-based).

#### The Phase 48 verified field

`ChangeRecord` has `matched_parcel_id` — a direct FK to the geometrically-verified parcel, set during change detection via geocode + ST_Contains. This is surfaced in `ChangeRecordResponse.matched_parcel_id` (schemas/monitoring.py line 37) and in the frontend `ChangeRecord` type (monitoring.ts line 27 — **not present yet**, needs to be added).

**Current frontend `ChangeRecord` type is missing `matched_parcel_id`:**

```typescript
// frontend/src/lib/types/monitoring.ts — MISSING field
export interface ChangeRecord {
  id: string
  // ... other fields ...
  matched_parcels: MatchedParcel[] | null
  matched_reports: MatchedReport[] | null
  // matched_parcel_id is NOT here — needs adding
}
```

The backend `ChangeRecordResponse` already includes it:

```python
# backend/app/schemas/monitoring.py line 37
matched_parcel_id: str | None = None
```

---

## What Phase 50 Must Build

### Plan 50-01: Parcel_id-first navigation from meldingen

The meldingen "Bekijk op kaart" button should prefer `change.matched_parcel_id` (Phase 48's geometrically verified match) over the postcode-matched list. Concretely:

1. **Add `matched_parcel_id?: string | null` to the frontend `ChangeRecord` type** in `frontend/src/lib/types/monitoring.ts`

2. **Add a dedicated "Bekijk op kaart" button per `matched_parcel_id`** in `meldingen.tsx` that navigates:
   ```typescript
   onNavigate({
     to: '/map',
     search: { parcel_id: change.matched_parcel_id },
   })
   ```
   This replaces the current address-based "Bekijk op kaart" button when `matched_parcel_id` is available, or sits alongside it as a secondary option.

3. **The map route already handles this** — no changes needed to `map.tsx` or the backend.

### Plan 50-02: Verify end-to-end — nothing to build on backend

The backend `POST /api/reports/from-parcel` already handles the verified parcel ID path. The `_find_or_create_wijk_project()` function already handles FLOW-04 (auto-create wijk hierarchy).

The only question is whether the parcel passed from meldingen is the Phase 48 `matched_parcel_id` (ParcelCache.id UUID, geometrically matched) or a postcode-matched one. If it's `matched_parcel_id`, the `from-parcel` endpoint already works correctly because it fetches ParcelCache by `body.parcel_id` (which IS `ParcelCache.id`) and derives the scan/project from there.

**Critical check:** The existing "Bekijk op kaart" in the `matched_parcels[]` list already passes `m.parcel_id` (a ParcelCache UUID from `find_matching_parcels()`). The `from-parcel` endpoint accepts any valid ParcelCache UUID — it does not require `matched_parcel_id` specifically. So the existing report generation button in the meldingen expanded view already works for FLOW-03 (report from verified parcel). The Phase 50 scope is about **the map flow specifically**: fly-to + amber marker + "Genereer rapport" on the map.

---

## Common Pitfalls

### Pitfall 1: `matched_parcel_id` vs `matched_parcels[].parcel_id` confusion

**What goes wrong:** Using the postcode-matched `matched_parcels[0].parcel_id` for the "Bekijk op kaart" (map) flow instead of `matched_parcel_id`.

**Why it matters:** `matched_parcel_id` is spatially verified (geocode + ST_Contains). `matched_parcels[]` is postcode-matched (string contains, may return multiple parcels from the same postcode area). The success criteria explicitly say "the report uses real kadaster/BAG data" tied to the geometrically verified parcel.

**How to avoid:** Use `change.matched_parcel_id` (singular, on the ChangeRecord) for the "Bekijk op kaart" navigation button. Keep `matched_parcels[]` for the list of parcels in expanded view.

### Pitfall 2: `useAllChanges(true)` already fetches include_matches

The meldingen page already calls `useAllChanges(true)` which sets `includeMatches=true`. This means `matched_parcels` and `matched_reports` are already populated. The `matched_parcel_id` field is also already returned by the backend but not typed in the frontend.

**How to avoid:** Only add `matched_parcel_id?: string | null` to the TypeScript type — no API changes needed.

### Pitfall 3: Popup auto-open on marker creation

The `addParcelMarker()` already calls `marker.togglePopup()` at line 228, which opens the popup immediately. This satisfies FLOW-02 ("visible without any additional clicks"). Do not change this behavior.

### Pitfall 4: `handledParcelRef` prevents re-trigger

The map's `useEffect` for parcel navigation uses `handledParcelRef` (line 429-452) to prevent re-triggering for the same parcel ID. This is correct — navigation clears the URL immediately (`navigate({ to: '/map', search: {}, replace: true })`). Do not remove this guard.

### Pitfall 5: `from-parcel` requires ParcelCache membership in org

The endpoint checks `ParcelCache.organization_id == organization_id`. A `matched_parcel_id` is always a ParcelCache that was created by a scan for this org (the spatial match is within the org's parcel data), so this is fine. But if a future change bypasses the ParcelCache lookup (e.g., passing a raw kadaster code), the 404 will fire.

### Pitfall 6: Wijk auto-create path uses scan link, not change record

`_find_or_create_wijk_project()` is triggered when `scan_row.project_id is None` AND `scan_row.wijk_naam` is set. This works for parcels that came from wijk-scoped scans. For parcels from gemeente-level scans without a `wijk_naam`, the auto-create is skipped and the report has no project. This is expected behavior (FLOW-04 says "if the parcel has no wijk project yet" — not all parcels have one).

---

## Code Examples

### Navigation from meldingen using matched_parcel_id

```typescript
// In meldingen.tsx expanded detail section
{change.matched_parcel_id && (
  <button
    onClick={() =>
      onNavigate({
        to: '/map',
        search: { parcel_id: change.matched_parcel_id! },
      })
    }
    className="inline-flex items-center gap-1.5 rounded-md border border-info/30 bg-info/10 px-3 py-1.5 text-xs font-medium text-info hover:bg-info/20 transition-colors"
  >
    <MapPinIcon />
    Bekijk op kaart
  </button>
)}
```

### TypeScript type addition

```typescript
// frontend/src/lib/types/monitoring.ts
export interface ChangeRecord {
  id: string
  project_id: string
  change_type: 'permit' | 'zoning'
  external_id: string
  title: string
  detected_at: string
  change_date: string
  gemeente_naam: string
  address: string | null
  source_url: string | null
  postcode: string | null
  matched_parcel_id?: string | null  // ADD THIS — Phase 48 geometrically verified match
  matched_parcels: MatchedParcel[] | null
  matched_reports: MatchedReport[] | null
  project_name?: string | null
  category_label?: string | null
}
```

### Already-working map handler (no changes needed)

```typescript
// map.tsx lines 429-452 — already handles standalone parcel_id
useEffect(() => {
  if (!urlParcelId || urlScanId || !mapReady || !mapRef.current || !accessToken) return
  if (handledParcelRef.current === urlParcelId) return
  handledParcelRef.current = urlParcelId

  const map = mapRef.current
  const pid = urlParcelId
  navigate({ to: '/map', search: {}, replace: true })
  layerToggleRef.current?.enableParcels()

  fetchParcelCentroid(pid, accessToken)
    .then(({ lng, lat, address }) => {
      const lngLat: [number, number] = [lng, lat]
      map.flyTo({ center: lngLat, zoom: 17, duration: 1200 })
      addParcelMarker(map, lngLat, address, pid, accessToken, navigate, reportMarkerRef)
    })
    .catch(() => {
      toast.error('Perceellocatie niet gevonden')
    })
}, [urlParcelId, urlScanId, mapReady, accessToken, navigate])
```

### Already-working addParcelMarker with popup + auto-open (no changes needed)

```typescript
// map.tsx lines 154-231 — complete implementation
function addParcelMarker(
  map: maplibregl.Map,
  lngLat: [number, number],
  address: string | null,
  parcelId: string,
  accessToken: string | null,
  navigateFn: ReturnType<typeof useNavigate>,
  markerRef: React.MutableRefObject<maplibregl.Marker | null>,
) {
  // ... creates amber SVG pin ...
  // ... popup with address + "Genereer rapport" button ...
  // ... on popup open, calls generateReportFromParcel() ...
  marker.togglePopup()  // <-- opens popup immediately, satisfying FLOW-02
  markerRef.current = marker
}
```

---

## Exact Scope of Changes for This Phase

Based on the research, Phase 50 requires **minimal frontend changes only**:

### Required changes

| File | Change | Why |
|------|--------|-----|
| `frontend/src/lib/types/monitoring.ts` | Add `matched_parcel_id?: string \| null` to `ChangeRecord` | Backend already returns it; frontend type is missing it |
| `frontend/src/routes/_authenticated/meldingen.tsx` | Add "Bekijk op kaart" button using `change.matched_parcel_id` in the expanded detail panel | Currently only shows address-based navigation; need parcel-ID-based navigation |

### No changes needed

| Component | Reason |
|-----------|--------|
| `map.tsx` | Already handles `parcel_id` URL param, already calls `addParcelMarker`, popup already opens immediately |
| `backend/app/reports/router.py` | `from-parcel` endpoint already works with any ParcelCache UUID |
| `backend/app/reports/router.py` `_find_or_create_wijk_project()` | Already implements FLOW-04 |
| `backend/app/scans/router.py` centroid endpoint | Already returns `{ lng, lat, address }` |
| `frontend/src/lib/api.ts` | `generateReportFromParcel` and `fetchParcelCentroid` already exist |

### Optional enhancements (at planner's discretion)

1. **Replace the address-based "Bekijk op kaart" button** with the parcel-ID-based one when `matched_parcel_id` is available. The address-based one is a fallback for when no parcel was matched.

2. **Show the "Genereer rapport" button directly in the meldingen expanded view** (already present) AND on the map marker (already present). No duplication concern — different contexts.

---

## UI Design Decisions

### Button placement in meldingen expanded view

Current expanded view has:
- Left panel: address, matched_parcels list (with "Bekijk perceel — {address}" links), matched_reports list, source_url link
- Right panel: "Bekijk op kaart" (address-based), "Genereer rapport" (per parcel)

For Phase 50:
- The right panel "Bekijk op kaart" button should use `matched_parcel_id` when available, falling back to the postcode+huisnummer navigation when not
- The "Bekijk op kaart" button label already says "Bekijk op kaart" — no label change needed
- The "Genereer rapport" button in the meldingen view (already there) remains — users can generate a report directly from meldingen OR from the map marker

### Map marker behavior (already correct)

- Amber SVG pin with inner white circle — matches `addReportMarker` style
- Popup auto-opens on marker placement — satisfies FLOW-02 ("visible without any additional clicks")
- Popup shows address + "Genereer rapport" button in amber style
- "Genereer rapport" button shows "Bezig..." loading state and disables on click
- On success: navigates to `/rapport/$id`
- On error: toast.error()

---

## Open Questions

1. **Should address-based "Bekijk op kaart" be removed when `matched_parcel_id` exists?**
   - What we know: Both navigations land on the map; address-based uses postcode+huisnummer lookup flow (shows PropertyQuickCard), parcel-based uses `addParcelMarker` (amber marker with "Genereer rapport")
   - What's unclear: UX preference — show one button or two?
   - Recommendation: Show only parcel-based when `matched_parcel_id` is available; show address-based as fallback when it's null. Cleaner UX, clear hierarchy.

2. **Should "Genereer rapport" in the meldingen expanded view also use `matched_parcel_id` directly?**
   - What we know: It already uses `m.parcel_id` from `matched_parcels[]`. Both are ParcelCache UUIDs. The `from-parcel` endpoint accepts any valid UUID.
   - What's unclear: Phase description says "report uses verified parcel ID from ChangeRecord" — this could mean the meldingen-side button should also use `matched_parcel_id`
   - Recommendation: Yes, update the meldingen "Genereer rapport" button to use `change.matched_parcel_id` when available. This is a single-line change and satisfies the success criterion exactly.

3. **What happens if `matched_parcel_id` is set but the parcel has been deleted (FK ondelete=SET NULL)?**
   - What we know: `matched_parcel_id` becomes NULL when the parcel is deleted; centroid endpoint returns 404
   - Recommendation: The existing `toast.error('Perceellocatie niet gevonden')` in the map effect handles this correctly. No additional handling needed.

---

## Sources

### Primary (HIGH confidence — codebase)

| File | Key Finding |
|------|-------------|
| `frontend/src/routes/_authenticated/meldingen.tsx` | Full navigation implementation; matched_parcels navigation uses `m.parcel_id`; no `matched_parcel_id` field used yet |
| `frontend/src/routes/_authenticated/map.tsx` | `addParcelMarker()` (line 154), standalone parcel `useEffect` (line 429), `MapSearchParams.parcel_id` (line 67) |
| `frontend/src/lib/types/monitoring.ts` | `ChangeRecord` interface — `matched_parcel_id` field missing |
| `frontend/src/lib/api.ts` | `generateReportFromParcel()` (line 563), `fetchParcelCentroid()` (line 722) |
| `backend/app/reports/router.py` | `generate_report_from_parcel()` (line 322), `_find_or_create_wijk_project()` (line 76) |
| `backend/app/schemas/monitoring.py` | `ChangeRecordResponse.matched_parcel_id: str \| None = None` (line 37) |
| `backend/app/models/change_record.py` | `matched_parcel_id` FK column (line 95) |
| `backend/app/scans/router.py` | `get_parcel_centroid()` endpoint (line 464) |
| `.planning/phases/48-parcel-matching/48-VERIFICATION.md` | Full Phase 48 verification — all 10 truths confirmed |

### Secondary (HIGH confidence — GSD config)

| Source | Content |
|--------|---------|
| MEMORY.md | DB patterns (direct commit, utcnow, Mapped syntax) |

---

## Metadata

**Confidence breakdown:**
- What already exists: HIGH — read directly from codebase
- Gap identification: HIGH — confirmed `matched_parcel_id` missing from frontend type and unused in meldingen navigation
- Backend completeness: HIGH — `from-parcel` endpoint and wijk auto-create verified complete from Phase 48 verification document

**Research date:** 2026-02-23
**Valid until:** Indefinite — based on codebase state, not external docs
