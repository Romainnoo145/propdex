---
phase: 111-portfolio-navigation
verified: 2026-03-16T03:52:22Z
status: gaps_found
score: 5/6 success criteria verified
gaps:
  - truth: "Clicking a wijk shows individual favorited parcel cards for ALL wijken including null-named ones"
    status: partial
    reason: "PortfolioWijkView passes empty string '' when wijk_naam is null (line 41), but handleWijkSelect converts '' to undefined via '|| undefined' (line 125), so clicking the 'Onbekende wijk' card never sets portfolio_wijk in URL and Level 4 is never reached for null-wijk parcels."
    artifacts:
      - path: "frontend/src/components/projects/PortfolioWijkView.tsx"
        issue: "Line 41: onWijkSelect(wijk.wijk_naam ?? '') passes '' for null wijk_naam — should pass 'Onbekende wijk' to match the URL sentinel value"
      - path: "frontend/src/components/projects/PortfolioView.tsx"
        issue: "Line 125: portfolio_wijk: wijkNaam || undefined converts '' to undefined, blocking navigation for null-wijk case"
    missing:
      - "PortfolioWijkView line 41: change `wijk.wijk_naam ?? ''` to `wijk.wijk_naam ?? 'Onbekende wijk'`"
human_verification:
  - test: "Confirm portfolio mode renders full-page Aura card grid (not bento blocks)"
    expected: "PortfolioModeToggle visible at top; clicking Portfolio shows responsive province card grid with amber-highlighted active provinces"
    why_human: "Visual layout and Aura design fidelity cannot be verified programmatically"
  - test: "Confirm Framer Motion animated pill transition on Werkruimte / Portfolio toggle"
    expected: "Smooth spring animation (stiffness 380, damping 30) as active pill slides between options"
    why_human: "Animation behavior requires runtime observation"
  - test: "Confirm browser back button navigates between drill-down levels"
    expected: "After drilling province → gemeente → wijk, pressing Back steps back through each level"
    why_human: "TanStack Router history integration requires browser interaction to verify"
---

# Phase 111: Portfolio Navigation Verification Report

**Phase Goal:** Users can navigate their saved parcels geographically — from a provincie overview down to individual favorited parcel cards — without leaving the Projecten page
**Verified:** 2026-03-16T03:52:22Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Projecten page shows full-page Aura card layout; 12 provincie cards, only those with favorites highlighted | ? HUMAN NEEDED | PortfolioProvincieView renders `provinceOptions.length` cards (derived from provincieGeojson — all 12 provinces), active/inactive CSS classes wired at lines 51-55. Layout verification needs human. |
| 2 | Clicking a provincie shows gemeente cards for that provincie; only gemeenten with favorites shown | ✓ VERIFIED | PortfolioView line 196: renders PortfolioGemeenteView when `selectedProvinceCode` is set. PortfolioGemeenteView receives `gemeenteCardsForProvince` filtered from `portfolio.gemeenten` by province (PortfolioView lines 84-90). Only gemeenten in portfolio response are shown. |
| 3 | Clicking a gemeente shows wijk cards; only wijken with favorites; each wijk shows "N percelen opgeslagen" badge | ✓ VERIFIED | PortfolioView line 188: renders PortfolioWijkView when `selectedGemeenteCode` set. wijkenForGemeente comes from `gem.wijken` in portfolio API response (lines 93-97). PortfolioWijkView renders amber count badge with `wijk.parcel_count` (line 50). |
| 4 | Clicking a wijk shows individual favorited parcel cards with Kadaster ID, gemeente, wijk, and pipeline stage | ✗ PARTIAL | Works for normal wijken. Null-wijk case broken: PortfolioWijkView passes `''` for null wijk_naam (line 41), handleWijkSelect converts `''` to `undefined` (line 125), so `portfolio_wijk` param is never set and Level 4 never renders for "Onbekende wijk" cards. For non-null wijken: FavoritedParcelCard renders parcel_id (mono), gemeente, wijk, PipelineStagePill — all correct. |
| 5 | Breadcrumb visible at every level and each segment is clickable | ✓ VERIFIED | PortfolioBreadcrumb renders null at Level 1 (intentional per spec — no "back" at root). At Level 2: "Projecten › [Province]" with clickable root. At Level 3: adds gemeente segment. At Level 4: adds wijk segment. All segments navigate by clearing deeper params. Always rendered in PortfolioView (line 143-147). |
| 6 | Ghost button at each level opens the corresponding detail view | ✓ VERIFIED | PortfolioProvincieView: "Bekijk op kaart →" → `/map` (line 88). PortfolioGemeenteView: → `/map?gemeente_code=...` (line 100). PortfolioWijkView: → `/map?gemeente_code=...` (line 59). FavoritedParcelCard: → `/map?gemeente_code=...` + Sonner toast (PortfolioView line 172-177). |

**Score:** 5/6 truths verified (1 partial)

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `frontend/src/components/projects/PortfolioView.tsx` | 80 | 217 | ✓ VERIFIED | Orchestrates 4-level drill-down via URL params; imports all sub-views + FavoritedParcelCard |
| `frontend/src/components/projects/PortfolioProvincieView.tsx` | 60 | 101 | ✓ VERIFIED | 12 province cards with SVG silhouettes, active/inactive states, ghost button |
| `frontend/src/components/projects/PortfolioGemeenteView.tsx` | 50 | 112 | ✓ VERIFIED | Gemeente cards with dual-path SVG, filtered to selected province |
| `frontend/src/components/projects/PortfolioWijkView.tsx` | 50 | 70 | ✓ VERIFIED | Wijk cards with amber count badge — null wijk_naam display correct, but click handler has bug |
| `frontend/src/components/projects/PortfolioBreadcrumb.tsx` | 30 | 114 | ✓ VERIFIED | Clickable breadcrumb, 4 levels, clears deeper params on click |
| `frontend/src/components/projects/PortfolioModeToggle.tsx` | 30 | 86 | ✓ VERIFIED | Pill toggle with Framer Motion layoutId, clears conflicting URL params on mode switch |
| `frontend/src/hooks/useFavorites.ts` contains `usePortfolio` | — | 157 | ✓ VERIFIED | usePortfolio hook at line 28, queryKey ['portfolio'], staleTime 5min, enabled when authenticated |
| `frontend/src/components/projects/PipelineStagePill.tsx` | 20 | 23 | ✓ VERIFIED | 5 pipeline stages with distinct Aura-compatible color tokens |
| `frontend/src/components/projects/FavoritedParcelCard.tsx` | 40 | 47 | ✓ VERIFIED | parcel_id mono, gemeente, wijk, PipelineStagePill, nl-NL date, ghost button |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PortfolioModeToggle.tsx` | `projectenSearchSchema` | `portfolio_mode` URL param | ✓ WIRED | Line 31: `portfolio_mode: true` / line 47: `portfolio_mode: undefined` |
| `useFavorites.ts` | `/api/portfolio` | useQuery in usePortfolio | ✓ WIRED | Line 33: `apiFetch('/api/portfolio', ...)`, queryKey `['portfolio']` |
| `PortfolioView.tsx` | `PortfolioProvincieView\|PortfolioGemeenteView\|PortfolioWijkView` | conditional render on portfolio_* URL params | ✓ WIRED | Lines 187/196/206: conditional renders based on selectedWijkNaam/selectedGemeenteCode/selectedProvinceCode |
| `PortfolioView.tsx` | `FavoritedParcelCard` | grid render at wijk level | ✓ WIRED | Line 10 import, line 168: rendered in wijk-level IIFE |
| `FavoritedParcelCard.tsx` | `PipelineStagePill` | stage pill from favorite.pipeline_stage | ✓ WIRED | Line 2 import, line 30: `<PipelineStagePill stage={favorite.pipeline_stage} />` |
| `useToggleFavorite` onSettled | `['portfolio']` query invalidation | queryClient.invalidateQueries | ✓ WIRED | Lines 152-153: invalidates both `['favorites']` and `['portfolio']` |
| `ProjectenPage.tsx` | `PortfolioView` | `isPortfolioMode` branch | ✓ WIRED | Line 86: `{isPortfolioMode && <PortfolioView ... />}` with all required props passed |
| `PortfolioWijkView` null wijk_naam | `'Onbekende wijk'` URL sentinel | `wijk.wijk_naam ?? 'Onbekende wijk'` | ✗ NOT WIRED | Line 41 passes `''` not `'Onbekende wijk'`; handleWijkSelect line 125 converts `''` → `undefined` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PORT-01 | 111-01 | Projecten page is full-page layout (Aura styling, not bento) | ✓ SATISFIED | ProjectenPage uses space-y-4 full-width layout; PortfolioModeToggle always visible |
| PORT-02 | 111-01 | Provincie level shows image cards for all 12 Dutch provinces | ✓ SATISFIED | PortfolioProvincieView renders provinceOptions (all 12 from provincieGeojson) with SVG silhouettes |
| PORT-03 | 111-01 | Clicking a provincie shows gemeente cards within that provincie (SVG silhouettes) | ✓ SATISFIED | PortfolioGemeenteView with dual-path SVG via geoJsonToSvgDualPath |
| PORT-04 | 111-01 | Clicking a gemeente shows wijk cards (text + count badge, no SVG) | ✓ SATISFIED | PortfolioWijkView: text-only cards with amber parcel_count badge |
| PORT-05 | 111-02 | Clicking a wijk shows favorited parcel cards (Kadaster ID, gemeente, wijk, pipeline stage) | ✗ PARTIAL | Works for named wijken; null-wijk click never reaches Level 4 due to '' → undefined bug |
| PORT-06 | 111-01, 111-02 | Ghost button at bottom of each level to open detail view | ✓ SATISFIED | Ghost buttons present at province, gemeente, wijk, and parcel card levels |
| PORT-07 | 111-01 | Breadcrumb navigation (Projecten → Limburg → Venlo → Wijk 01) | ✓ SATISFIED | PortfolioBreadcrumb renders correct segments at levels 2-4 with clickable navigation |
| PORT-08 | 111-01 | Only show provincies/gemeenten/wijken that contain favorited parcels | ✓ SATISFIED | Provinces: Set-based active check from portfolio counts. Gemeenten: filtered from portfolio.gemeenten. Wijken: from gem.wijken in portfolio API. |
| FAV-04 | 111-01, 111-02 | Wijk and gemeente cards show favorite count badge ("N percelen opgeslagen") | ✓ SATISFIED | PortfolioWijkView: amber pill with `wijk.parcel_count` + "percelen". PortfolioGemeenteView: `gemeente.total_count` count. PortfolioProvincieView: province-level count. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PortfolioWijkView.tsx` | 41 | `wijk.wijk_naam ?? ''` passes empty string for null wijk_naam | ✗ BLOCKER | Prevents clicking "Onbekende wijk" card from drilling to Level 4 — null-named parcels unreachable |
| `PortfolioView.tsx` | 32-34 | `provincieGeojson` and `gemeenteGeojson` props accepted in interface but destructured away (unused) | INFO | Dead prop surface — no functional impact, minor cleanup |
| `PortfolioView.tsx` | 27 | JSDoc comment still says "plan 2 will add FavoritedParcelCard" (stale) | INFO | Stale comment, no functional impact |

### Human Verification Required

#### 1. Full-Page Aura Layout (PORT-01)

**Test:** Navigate to `/projecten`, click "Portfolio" toggle
**Expected:** Province card grid appears in responsive 2/3/4-col layout with Aura glass cards and amber-highlighted active provinces
**Why human:** Visual design fidelity (glass effect, amber borders, SVG silhouettes) cannot be verified by grep

#### 2. Framer Motion Pill Animation

**Test:** Click "Werkruimte" and "Portfolio" tabs in the toggle
**Expected:** Active pill slides smoothly between options with spring animation
**Why human:** Animation quality requires runtime observation

#### 3. Browser Back Button Navigation

**Test:** Drill province → gemeente → wijk, then press browser back button
**Expected:** Each back press steps up one drill-down level (wijk → gemeente → provincie → root)
**Why human:** TanStack Router history push requires browser interaction

### Gaps Summary

One functional bug blocks part of Success Criterion 4 (PORT-05): parcels grouped under null-named wijken cannot be reached via the portfolio drill-down. The "Onbekende wijk" card renders and shows the correct count badge, but clicking it passes `''` to `handleWijkSelect`, which discards the empty string as falsy and never sets `portfolio_wijk`, so Level 4 never renders.

The fix is a one-line change in `PortfolioWijkView.tsx` line 41:
- Current: `onWijkSelect(wijk.wijk_naam ?? '')`
- Required: `onWijkSelect(wijk.wijk_naam ?? 'Onbekende wijk')`

The rest of the implementation is complete and correctly wired. All 9 artifacts exist and are substantive. All key links verified except the null-wijk sentinel. TypeScript check passes with 0 errors (767 warnings, pre-existing).

---

_Verified: 2026-03-16T03:52:22Z_
_Verifier: Claude (gsd-verifier)_
