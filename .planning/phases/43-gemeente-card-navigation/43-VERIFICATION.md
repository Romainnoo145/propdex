---
phase: 43-gemeente-card-navigation
verified: 2026-02-22T07:55:08Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 43: Gemeente Card Navigation Verification Report

**Phase Goal:** Users see their scanned gemeenten as visual cards on the Projecten page — each card shows the municipality boundary shape, name, and a badge when there are unread changes
**Verified:** 2026-02-22T07:55:08Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | geoJsonToSvgPath converts GeoJSON Polygon or MultiPolygon into an SVG path string with correct Y-axis inversion and aspect-ratio-preserving scaling | VERIFIED | `geo-utils.ts` lines 58-139: handles both geometry types, uses `Math.min(drawW/lonRange, drawH/latRange)` for uniform scale, `maxLat - lat` for Y inversion, returns `{ d, viewBox }` |
| 2 | GemeenteCard renders an inline SVG silhouette, the gemeente name, and a conditional unread badge | VERIFIED | `GemeenteCard.tsx` lines 23-90: SVG rendered from svgData prop (lines 31-42), name with truncation (line 56-58), badge shown when `totalUnread > 0` (lines 61-65) |
| 3 | GemeenteCardGrid renders a responsive grid that is 3 columns on lg, 2 on sm, and 1 on mobile | VERIFIED | `GemeenteCardGrid.tsx` line 13: `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` — exact breakpoints match requirements |
| 4 | Projecten page displays monitoring gemeenten as visual cards in a responsive grid instead of accordion rows | VERIFIED | `ProjectList.tsx` lines 161-197: `monitoringProjects.map()` now renders inside `GemeenteCardGrid`, not in accordion structure |
| 5 | Each gemeente card shows a recognizable SVG silhouette sourced from CBS WFS data | VERIFIED | `ProjectList.tsx` lines 176-181: `gemeenteGeojson.features.find(f => f.properties?.statcode === gemeente.gemeente_code)` looks up CBS WFS feature, passes geometry to `geoJsonToSvgPath` |
| 6 | Each gemeente card displays the gemeente name and an unread notification badge when count > 0 | VERIFIED | `GemeenteCard.tsx` lines 54-65: name rendered in `<h4>`, badge conditionally rendered when `totalUnread > 0` |
| 7 | Cards maintain visual consistency across mobile, tablet, and desktop breakpoints | VERIFIED | `GemeenteCardGrid.tsx` line 13 (grid) + `GemeenteCard.tsx` line 30 (`aspect-[5/3]` card) — responsive structure confirmed |
| 8 | Regular (non-monitoring) projects continue to render in the existing accordion list below the card grid | VERIFIED | `ProjectList.tsx` lines 273-354: `regularProjects.map(...)` accordion block untouched, appears after the monitoring card grid section |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/geo-utils.ts` | geoJsonToSvgPath function | VERIFIED | 140 lines; exports both `calculateBboxFromGeometry` and `geoJsonToSvgPath`; handles Polygon + MultiPolygon; Y-axis inversion and aspect-ratio scale confirmed at lines 97, 109 |
| `frontend/src/components/projects/GemeenteCard.tsx` | Single gemeente card component | VERIFIED | 90 lines; named export `GemeenteCard`; stateless (receives props); SVG silhouette, name, badge all present |
| `frontend/src/components/projects/GemeenteCardGrid.tsx` | Responsive card grid wrapper | VERIFIED | 40 lines; exports `GemeenteCardGrid` and `GemeenteCardGridSkeleton`; correct breakpoints; skeleton mirrors card layout with `aspect-[5/3]` + text area |
| `frontend/src/components/projects/ProjectList.tsx` | Integrated gemeente card grid on Projecten page | VERIFIED | 507 lines total (main component ~244 lines + helpers); monitoring accordion replaced with card grid; all four imports wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GemeenteCard.tsx` | `geo-utils.ts` | No direct import | INFO | GemeenteCard is stateless — receives pre-computed `svgData` prop. Import link exists in `ProjectList.tsx` instead (by design: parent owns fetch/compute) |
| `GemeenteCardGrid.tsx` | `GemeenteCard.tsx` | No direct import | INFO | Grid is a thin wrapper taking `children` — GemeenteCard rendered by parent. Not a wiring gap |
| `ProjectList.tsx` | `GemeenteCardGrid.tsx` | `import { GemeenteCardGrid, GemeenteCardGridSkeleton }` | WIRED | Line 16: both exports imported and used at lines 164, 166, 197 |
| `ProjectList.tsx` | `GemeenteCard.tsx` | `import { GemeenteCard }` | WIRED | Line 15: imported; used at line 184 inside `monitoringProjects.map()` |
| `ProjectList.tsx` | `GemeenteBoundariesLayer.tsx` | `import fetchGemeenteGeoJSON` | WIRED | Line 13: imported; called in `useEffect` at line 98; result stored in state and used at lines 163-181 |
| `ProjectList.tsx` | `geo-utils.ts` | `import geoJsonToSvgPath` | WIRED | Line 14: imported; called at line 180 inside render loop |

Note: The plan 43-01 key_links listed GemeenteCard importing geoJsonToSvgPath, but the actual design (correctly) places that import in ProjectList.tsx (the parent). This is an architectural improvement over the plan, not a gap.

### Requirements Coverage

No explicit phase 43 requirements row found in REQUIREMENTS.md. Phase goal satisfied in full per the 8 observable truths above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `geo-utils.ts` | 119 | `return null` inside `.map()` filter chain | Info | Valid null-guard; filtered via `pt !== null` type predicate immediately after |
| `ProjectList.tsx` | 203, 205 | `return null` inside IIFE | Info | Valid early-return guards in expanded wijk panel; not stub behavior |

No blockers or warnings found.

### Human Verification Required

#### 1. SVG Silhouette Rendering

**Test:** Log in, ensure at least one gemeente monitoring project exists, navigate to Projecten page
**Expected:** Gemeente appears as a card with a visible SVG outline of the municipality boundary shape
**Why human:** Cannot verify visual rendering of SVG paths from GeoJSON coordinates programmatically

#### 2. Loading Skeleton Transition

**Test:** Navigate to Projecten page with monitoring projects; observe the moment before GeoJSON loads
**Expected:** Pulse-animated skeleton cards appear briefly, then transition to actual gemeente cards with SVG silhouettes
**Why human:** Requires observing real-time network loading behavior

#### 3. Unread Badge Display

**Test:** Ensure a monitoring gemeente has wijk children with unread changes; navigate to Projecten
**Expected:** A red circular badge with the count appears on the gemeente card top-right area
**Why human:** Requires real notification data to be present in database

#### 4. Card Click — Wijk Expansion

**Test:** Click a gemeente card on the Projecten page
**Expected:** An inline wijk list panel expands below the card grid; clicking again collapses it
**Why human:** Interactive state behavior requires live browser testing

### Gaps Summary

No gaps found. All eight observable truths are verified. All four artifacts exist, are substantive (not stubs), and are correctly wired. The type checker confirms zero errors across all modified files. All three commits (83de928, 71cf026, 8857b6d) exist in git history with the correct file changes.

The only human verification items are visual/interactive behaviors that cannot be confirmed via static code analysis.

---

_Verified: 2026-02-22T07:55:08Z_
_Verifier: Claude (gsd-verifier)_
