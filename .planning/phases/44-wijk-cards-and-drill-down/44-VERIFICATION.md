---
phase: 44-wijk-cards-and-drill-down
verified: 2026-02-22T08:25:56Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 44: Wijk Cards and Drill-Down Verification Report

**Phase Goal:** Users can click a gemeente card to see its wijken as visual cards, and click a wijk card to land on the results table filtered to that wijk's scan data
**Verified:** 2026-02-22T08:25:56Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WijkCard renders an SVG silhouette of the wijk boundary shape (CARD-04) | VERIFIED | WijkCard.tsx L33-44: conditional `<svg viewBox={svgData.viewBox}>` with `<path d={svgData.d} className="fill-amber-accent/20 stroke-amber-accent" />` |
| 2 | WijkCard displays the wijk name prominently (CARD-05) | VERIFIED | WijkCard.tsx L58-61: `<h4 className="truncate text-base font-semibold text-grey-100">{wijk.wijk_naam ?? wijk.name}</h4>` |
| 3 | WijkCard displays a notification badge when unreadCount > 0 (CARD-06) | VERIFIED | WijkCard.tsx L63-67: `{unreadCount > 0 && <span className="...bg-error...">{unreadCount}</span>}` — conditional render guards correctly |
| 4 | WijkCardGrid fetches wijk GeoJSON once via useWijkGeoJSON and passes svgData to each card | VERIFIED | WijkCardGrid.tsx L54: `useWijkGeoJSON(gemeente.gemeente_code)`; L85-89: svgData computed and passed via renderCard |
| 5 | WijkCardGrid shows a loading skeleton while wijk GeoJSON is loading | VERIFIED | WijkCardGrid.tsx L71-72: `{isLoading ? <GemeenteCardGridSkeleton count={...} /> : ...}` |
| 6 | WijkCardGrid includes a breadcrumb back button to return to gemeente view | VERIFIED | WijkCardGrid.tsx L59-68: `<button onClick={onBack}>← Gemeenten</button>` breadcrumb pattern |
| 7 | Clicking a gemeente card switches the view to show that gemeente's wijk cards (NAV-02) | VERIFIED | ProjectList.tsx L82: `selectedGemeenteId` state; L164: conditional renders WijkCardGrid when set; L213: `onClick={() => setSelectedGemeenteId(gemeente.id)}` on GemeenteCard |
| 8 | Clicking a wijk card navigates to /resultaten with scan_id pre-set to the latest completed scan (NAV-03) | VERIFIED | ProjectList.tsx L354-360: `WijkCardWithNav.handleClick` finds `s.status === 'completed'` and calls `navigate({ to: '/resultaten', search: { scan_id: latestScan.scan_id } })` |
| 9 | Clicking a wijk card with no completed scan shows a Dutch toast message and does NOT navigate (Pitfall 4) | VERIFIED | ProjectList.tsx L355-358: `if (!latestScan) { toast.info('Nog geen scan beschikbaar voor deze wijk'); return }` — early return prevents navigation |
| 10 | User can click back button to return from wijk view to gemeente view without losing page state (SC-4) | VERIFIED | ProjectList.tsx L174: `onBack={() => setSelectedGemeenteId(null)}` — local state resets to gemeente grid; regular project expandedId and other state preserved |
| 11 | The old expandedGemeenteId inline wijk list is fully replaced by the WijkCardGrid view | VERIFIED | `grep expandedGemeenteId ProjectList.tsx` returns 0 matches; selectedGemeenteId is the sole view-switching mechanism |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/hooks/useWijkGeoJSON.ts` | TanStack Query hook wrapping fetchWijken | VERIFIED | 31 lines, exports `useWijkGeoJSON`, queryKey `['wijk-geojson', gemeenteCode]`, staleTime 30 min, enabled guard on accessToken+gemeenteCode |
| `frontend/src/components/projects/WijkCard.tsx` | Stateless wijk card component | VERIFIED | 95 lines, exports `WijkCard`, SVG silhouette + AreaGridIcon placeholder + name heading + conditional badge |
| `frontend/src/components/projects/WijkCardGrid.tsx` | Data-fetching container for wijk cards with breadcrumb and renderCard prop | VERIFIED | 97 lines, exports `WijkCardGrid`, uses renderCard render prop, breadcrumb, skeleton, feature match by statnaam |
| `frontend/src/components/projects/ProjectList.tsx` | Integrated drill-down with selectedGemeenteId and WijkCardWithNav | VERIFIED | 500 lines, selectedGemeenteId state, WijkCardGrid render when set, WijkCardWithNav sub-component, expandedGemeenteId fully absent |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useWijkGeoJSON.ts` | `fetchWijken` in `lib/api.ts` | TanStack Query queryFn | VERIFIED | L27: `queryFn: () => fetchWijken(gemeenteCode!, accessToken)` |
| `WijkCardGrid.tsx` | `useWijkGeoJSON.ts` | hook call | VERIFIED | L4 import + L54: `useWijkGeoJSON(gemeente.gemeente_code)` |
| `WijkCardGrid.tsx` | `lib/geo-utils.ts` | `geoJsonToSvgPath` call | VERIFIED | L5 import + L85-89: `geoJsonToSvgPath(feature.geometry as ...)` |
| `WijkCardGrid.tsx` | `WijkCard.tsx` | renderCard render prop (not direct import) | VERIFIED | WijkCard NOT imported in WijkCardGrid; parent passes renderCard prop and WijkCardWithNav renders WijkCard |
| `ProjectList.tsx` | `WijkCardGrid.tsx` | conditional render when selectedGemeenteId set | VERIFIED | L18 import + L164-186: `selectedGemeenteId ? (() => { ... <WijkCardGrid ...> })() : gemeenteGrid` |
| `ProjectList.tsx` | `/resultaten` route | `navigate({ to: '/resultaten', search: { scan_id } })` | VERIFIED | L360: exact pattern matches plan spec |
| `WijkCardWithNav` | `useProjectScans` hook | scan lookup per wijk for navigation | VERIFIED | L352: `const { data } = useProjectScans(wijk.id)` at component top level (valid hook usage) |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| CARD-04: WijkCard SVG silhouette | SATISFIED | Amber fill/stroke path rendered when svgData provided |
| CARD-05: WijkCard wijk name display | SATISFIED | h4 heading with wijk_naam fallback to name |
| CARD-06: WijkCard unread badge | SATISFIED | Conditional badge on bg-error |
| NAV-02: Gemeente card click shows wijk cards | SATISFIED | selectedGemeenteId view switch |
| NAV-03: Wijk card click to /resultaten?scan_id | SATISFIED | WijkCardWithNav navigation |
| SC-4: Back navigation preserves page state | SATISFIED | Local state reset, rest of ProjectList state intact |
| Pitfall 4: Toast for no completed scan | SATISFIED | Dutch toast + early return |
| Pitfall 1: statnaam not statcode for feature matching | SATISFIED | WijkCardGrid.tsx L82 explicitly uses statnaam |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| WijkCard.tsx | 16, 74 | "placeholder" in comment | Info | Describes placeholder icon behavior — not a stub. The icon renders real SVG rects when no svgData is available. Not a functional concern. |

No blockers or warnings found.

---

### Human Verification Required

The following items require visual or runtime verification that cannot be determined from static analysis:

#### 1. SVG Silhouette Visual Accuracy

**Test:** Log in, navigate to a monitored gemeente, click its gemeente card to enter wijk view. Check that each wijk card displays a recognizable boundary outline.
**Expected:** Wijk shapes visible as amber-outlined polygons in the card SVG area; cards without a matching CBS feature show the 4-square grid icon.
**Why human:** Cannot verify that `statnaam` values in CBS WFS data match `wijk_naam` values in ProjectResponse without a live API call.

#### 2. Navigation Flow End-to-End

**Test:** Click a wijk card that has a completed scan. Verify landing on /resultaten with the correct scan pre-selected.
**Expected:** Results table loads filtered to that wijk's scan data; scan_id URL param is populated.
**Why human:** Route integration with search param parsing in ResultatenPage cannot be verified statically.

#### 3. Toast on No Completed Scan

**Test:** Click a wijk card for a wijk with no completed scan (or pending/failed scans only).
**Expected:** `toast.info('Nog geen scan beschikbaar voor deze wijk')` appears as a notification; no navigation occurs.
**Why human:** Requires runtime state — a project with scans in non-completed status.

#### 4. Back Navigation State Preservation

**Test:** Expand a regular project (non-monitoring), then navigate into a gemeente's wijk view, then click back.
**Expected:** Gemeente grid is restored; the previously expanded regular project remains expanded.
**Why human:** `expandedId` state is separate from `selectedGemeenteId` — verification that they do not interfere requires runtime interaction.

---

### Gaps Summary

No gaps. All 11 observable truths verified against the actual codebase. All artifacts exist, are substantive (no stubs), and are fully wired. TypeScript compilation passes with 0 errors. The old `expandedGemeenteId` accordion pattern is fully absent from ProjectList.tsx.

The phase goal is achieved: gemeente cards trigger wijk card view via `selectedGemeenteId` state switch, wijk cards navigate to `/resultaten?scan_id=<latest-completed>` via `WijkCardWithNav`, and the Dutch toast guard prevents navigation when no completed scan exists.

---

_Verified: 2026-02-22T08:25:56Z_
_Verifier: Claude (gsd-verifier)_
