# S06: Gemeente & Wijk Data-First Panel Content

**Goal:** GemeenteContextPanel and WijkMapPanel show real data inline — KPI grids with real numbers, CBS cards, juridisch klimaat stats — not just navigation buttons. Modals reserved for drill-down detail only.

**Demo:** Click a wijk on the map → WijkMapPanel shows pill tabs with KPI grid (inwoners, WOZ, scan count, percelen), CBS breakdown cards (neighborhood, nabijheid, criminaliteit, age distribution, income, household), and jurisprudence section. Click a gemeente → Demografie tab shows aggregated CBS cards inline instead of just opening a modal. Overzicht tab shows juridisch klimaat summary card.

## Must-Haves

- WijkMapPanel has pill tabs (Overzicht / Demografie / Juridisch) with animated indicator
- WijkMapPanel Overzicht shows KPI summary grid (inwoners, WOZ, scan count, percelen)
- WijkMapPanel Demografie tab shows all 6 CBS cards inline (CbsNeighborhoodCard, NabijheidCard, CriminaliteitCard, AgeDistributionCard, IncomeCard, HouseholdCard)
- WijkMapPanel Juridisch tab shows JurisprudenceSection (already rendered, just moved to tab)
- GemeenteContextPanel Demografie tab shows aggregated CBS cards inline (not just opens modal)
- GemeenteContextPanel Overzicht tab shows JuridischKlimaatCard summary
- `aggregateMetrics` extracted from DemografieModal to shared util for reuse
- CBS cards handle null data gracefully (existing null guards preserved)
- ParcelDetailPanel and ParcelDetailModal UNTOUCHED
- layoutId "wijk-tab" used (distinct from "gemeente-tab")

## Proof Level

- This slice proves: integration
- Real runtime required: yes (CBS data from scanned wijken)
- Human/UAT required: yes (visual verification of card layouts at 400px panel width)

## Verification

- `cd frontend && npx tsc --noEmit` — zero errors
- Browser: click wijk → panel shows pill tabs, KPI grid, 6 CBS cards with real data from latest scan
- Browser: click gemeente → Demografie tab shows aggregated CBS breakdown inline
- Browser: gemeente Overzicht tab shows juridisch klimaat summary
- Browser: modals still accessible from summary cards for drill-down
- ParcelDetailPanel.tsx git-unchanged

## Observability / Diagnostics

- Runtime signals: CBS cards return null when data is unavailable (visible as absent sections in panel)
- Inspection surfaces: React DevTools → activeTab state on WijkMapPanel and GemeenteContextPanel
- Failure visibility: Empty CBS sections with "—" fallback values indicate missing neighborhood_metrics

## Integration Closure

- Upstream surfaces consumed: `latestScan.neighborhood_metrics` (WijkMapPanel), `scans[].neighborhood_metrics` (GemeenteContextPanel), `aggregateMetrics` from DemografieModal
- New wiring introduced: Shared `aggregateMetrics` util, pill tabs on WijkMapPanel, inline CBS cards on both panels
- What remains before the milestone is truly usable end-to-end: nothing — S06 is the final slice

## Tasks

- [x] **T01: WijkMapPanel data-first redesign with pill tabs and CBS cards** `est:1h`
  - Why: WijkMapPanel currently shows only CbsNeighborhoodCard and JurisprudenceSection without tabs or KPI grid. Need pill tabs, KPI summary, and all 6 CBS cards inline.
  - Files: `frontend/src/components/map/panels/WijkMapPanel.tsx`
  - Do: Add pill tabs (Overzicht/Demografie/Juridisch) with framer-motion layoutId="wijk-tab". Add KPI grid to Overzicht (inwoners, WOZ, scan count from latestScan). Move JurisprudenceSection to Juridisch tab. Add all 6 CBS cards to Demografie tab: CbsNeighborhoodCard (already imported), NabijheidCard, CriminaliteitCard, AgeDistributionCard, IncomeCard, HouseholdCard. Guard each with optional field check (metrics.nabijheid && ...). Keep inside hasCompletedScan guard.
  - Verify: `cd frontend && npx tsc --noEmit` zero errors. Browser: click wijk with completed scan → 3 tabs visible, KPIs show real numbers, Demografie tab shows CBS cards.
  - Done when: WijkMapPanel renders pill tabs with KPI grid and all 6 CBS breakdown cards from latestScan.neighborhood_metrics

- [ ] **T02: GemeenteContextPanel inline CBS content and shared aggregation util** `est:1h`
  - Why: GemeenteContextPanel Demografie tab currently just opens DemografieModal. Need inline CBS aggregate cards so users see data without clicking into a modal. Also add JuridischKlimaatCard to Overzicht.
  - Files: `frontend/src/components/map/panels/GemeenteContextPanel.tsx`, `frontend/src/components/map/panels/gemeente/DemografieModal.tsx`, `frontend/src/lib/utils/cbs-aggregation.ts` (new)
  - Do: Extract `aggregateMetrics`, `avg`, `sum` functions from DemografieModal.tsx into new `frontend/src/lib/utils/cbs-aggregation.ts`. Update DemografieModal to import from shared util. In GemeenteContextPanel, replace Demografie tab's modal-opener with inline CBS aggregate cards: compute aggregated metrics via shared util, render AgeDistributionCard, IncomeCard, HouseholdCard with aggregated data. Keep "Meer details" button that opens DemografieModal for full drill-down. Add JuridischKlimaatCard to Overzicht tab below KPI grid (import useGemeenteAnalysis hook).
  - Verify: `cd frontend && npx tsc --noEmit` zero errors. Browser: click gemeente → Demografie tab shows inline CBS cards. Overzicht shows juridisch klimaat card. Modal still accessible via "Meer details" button.
  - Done when: GemeenteContextPanel Demografie tab renders aggregated CBS cards inline, Overzicht shows JuridischKlimaatCard, DemografieModal still works for drill-down

## Files Likely Touched

- `frontend/src/components/map/panels/WijkMapPanel.tsx`
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx`
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx`
- `frontend/src/lib/utils/cbs-aggregation.ts` (new)
