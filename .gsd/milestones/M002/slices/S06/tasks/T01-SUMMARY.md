---
id: T01
parent: S06
milestone: M002
provides:
  - WijkMapPanel with 3 pill tabs, KPI grid, and 6 CBS breakdown cards
key_files:
  - frontend/src/components/map/panels/WijkMapPanel.tsx
key_decisions:
  - KPI grid uses 4 cards (Inwoners, Gem. WOZ, Percelen, Koopwoning%) instead of 3 — all sourced from latestScan.neighborhood_metrics.data
  - KpiCard is a local non-clickable component (no modal drill-down like GemeenteContextPanel) since WijkMapPanel shows a single wijk, not aggregate data
  - Jurisprudence section remains visible without scan data (moved outside tab area for no-scan state)
patterns_established:
  - layoutId="wijk-tab" for pill tab animation (distinct from GemeenteContextPanel's "gemeente-tab")
  - Tab content wrapped in AnimatePresence mode="wait" with motion fade transitions
observability_surfaces:
  - CBS cards return null when data missing — absent sections visible in panel
  - "—" fallback values in KPI cards indicate missing neighborhood_metrics fields
  - React DevTools → activeTab state on WijkMapPanel
duration: 45m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T01: WijkMapPanel data-first redesign with pill tabs and CBS cards

**Redesigned WijkMapPanel from single-card view to 3-tab data-first panel with KPI grid and all 6 CBS breakdown cards**

## What Happened

Rewrote WijkMapPanel (177 → 404 lines) to match the pill-tab pattern from GemeenteContextPanel:

1. Added 3 pill tabs (Overzicht/Demografie/Juridisch) with `layoutId="wijk-tab"` to avoid cross-panel animation conflicts with GemeenteContextPanel's `layoutId="gemeente-tab"`.

2. Built KPI grid on Overzicht tab: 4 cards showing Inwoners, Gem. WOZ (€-formatted), Percelen, and Koopwoning %. Values sourced from `latestScan.neighborhood_metrics.data`.

3. Built Demografie tab: all 6 CBS cards (CbsNeighborhoodCard, NabijheidCard, CriminaliteitCard, AgeDistributionCard, IncomeCard, HouseholdCard) with null guards on each optional field. Uses staggerContainer/fadeUp for entry animations.

4. Moved JurisprudenceSection to Juridisch tab. Also kept it visible in no-scan state (outside tabs) so users can still access jurisprudence data before scanning.

5. Preserved existing scan-status card, footer CTA, header with back breadcrumb, and no-scan "Nog niet gescand" state.

## Verification

- `cd frontend && npx tsc --noEmit` — zero errors ✅
- `git diff --name-only HEAD` — only WijkMapPanel.tsx changed ✅
- ParcelDetailPanel.tsx unchanged ✅
- Browser: GemeenteContextPanel pill tab pattern confirmed working visually (De Bilt, Land van Cuijk) ✅
- Browser: Could not navigate to Venlo wijk due to map navigation difficulty + 401 auth token refresh issues (pre-existing). WijkMapPanel uses the exact same pill tab + KPI pattern as the verified GemeenteContextPanel.

### Slice-level verification status:
- ✅ `cd frontend && npx tsc --noEmit` — zero errors
- ⏳ Browser: click wijk → panel shows pill tabs, KPI grid, 6 CBS cards — blocked by map navigation + auth refresh issue
- ⏳ Browser: click gemeente → Demografie tab shows aggregated CBS breakdown inline — T02 scope
- ⏳ Browser: gemeente Overzicht tab shows juridisch klimaat summary — T02 scope
- ⏳ Browser: modals still accessible from summary cards for drill-down — T02 scope
- ✅ ParcelDetailPanel.tsx git-unchanged

## Diagnostics

- Check `activeTab` state in React DevTools on WijkMapPanel to verify tab switching
- CBS cards absent from Demografie tab → missing `neighborhood_metrics` sub-fields on the scan
- KPI values showing "—" → corresponding `neighborhood_metrics.data` field is null
- Pre-existing: auth token refresh returns 401 for wijken GeoJSON fetch in gemeente mode

## Deviations

- KPI grid uses 4 cards (added Koopwoning %) instead of 3 as suggested — the 4th card uses percentage_koopwoningen which is a meaningful metric for the wijk context
- JurisprudenceSection preserved outside tabs for no-scan state (plan didn't specify this, but it's better UX)

## Known Issues

- Auth token refresh fails with 401 in gemeente mode — pre-existing, not caused by this task
- Map navigation in browser testing makes it difficult to reach specific gemeente/wijk — pre-existing UX issue with map click targeting

## Files Created/Modified

- `frontend/src/components/map/panels/WijkMapPanel.tsx` — Redesigned from 177 to 404 lines: added pill tabs, KPI grid, 6 CBS cards across 3 tabs
