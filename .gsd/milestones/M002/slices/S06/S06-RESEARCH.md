# S06: Gemeente & Wijk Data-First Panel Content — Research

**Date:** 2026-03-17

## Summary

This slice transforms GemeenteContextPanel and WijkMapPanel from navigation shells into data-first panels that surface real KPI numbers, CBS metrics, jurisprudentie stats, and meldingen counts inline — matching the ParcelDetailPanel pattern of pill tabs, KPI grids, and data cards. Currently, GemeenteContextPanel has a 2×2 KPI grid and wijk list (347 lines), and WijkMapPanel (177 lines) shows a scan status card, CbsNeighborhoodCard, and JurisprudenceSection. The slice extends these with additional CBS cards (Nabijheid, Criminaliteit, AgeDistribution, Income, Household) and richer inline KPI summaries, while keeping modals for drill-down detail only.

All the data components already exist and are battle-tested: CbsNeighborhoodCard (143 lines), CriminaliteitCard (181 lines), NabijheidCard (97 lines), JuridischKlimaatCard (142 lines), AgeDistributionCard (101 lines), IncomeCard (122 lines), HouseholdCard (101 lines). The CBS data types (CbsNeighborhoodMetrics with nested demografie, leeftijdsverdeling, huishoudens, inkomen, criminaliteit, nabijheid) are already on ScanListItem.neighborhood_metrics. The pattern is well-established — WijkDetailView.tsx in the projects page already renders these cards for wijk-level data. This is a known-pattern integration task.

## Recommendation

**Two tasks, bottom-up:**

1. **WijkMapPanel data-first redesign** — Add pill tabs (Overzicht/Demografie/Juridisch matching GemeenteContextPanel tab pattern), embed CBS data cards (CbsNeighborhoodCard, NabijheidCard, CriminaliteitCard, AgeDistributionCard, IncomeCard, HouseholdCard) inline, add KPI summary grid (inwoners, WOZ, scan count, percelen). Currently WijkMapPanel gets `latestScan: ScanListItem | null` which already carries `neighborhood_metrics`. CBS cards just need to be wired. JurisprudenceSection is already rendered.

2. **GemeenteContextPanel data-first redesign** — Add CBS summary cards inline on the Overzicht tab (aggregate from scanned wijken, same as DemografieModal does), add meldingen count KPI from useUnreadCounts or similar, add juridisch klimaat summary stats (JuridischKlimaatCard rendered inline). Currently the 2×2 KPI grid has Inwoners/WOZ/Scans/Wijken — enhance with actual CBS breakdowns below the KPI grid, and add a Demografie tab that shows CBS cards inline instead of just opening the modal.

Order: WijkMapPanel first (simpler, single data source from latestScan), then GemeenteContextPanel (aggregation across wijken, more complex).

## Implementation Landscape

### Key Files

- `frontend/src/components/map/panels/WijkMapPanel.tsx` (177 lines) — Currently shows scan status + CbsNeighborhoodCard + JurisprudenceSection. Add pill tabs, KPI grid, additional CBS cards (Nabijheid, Criminaliteit, AgeDistribution, Income, Household). Data source: `latestScan.neighborhood_metrics`.
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` (347 lines) — Currently has 2×2 KPI grid + wijk list. Add inline CBS aggregate cards on Overzicht tab, convert Demografie tab from modal-opener to inline content, add juridisch klimaat summary. Data source: aggregate from `scans[].neighborhood_metrics`.
- `frontend/src/components/map/panels/parcel/CategoryTabs.tsx` (54 lines) — Pill tab pattern to follow for both panels. Already used by ParcelDetailPanel and GemeenteContextPanel.
- `frontend/src/components/projects/CbsNeighborhoodCard.tsx` (143 lines) — Reuse directly in WijkMapPanel. Already used in WijkDetailView.
- `frontend/src/components/projects/NabijheidCard.tsx` (97 lines) — Takes `CbsNabijheid` from `metrics.nabijheid`.
- `frontend/src/components/projects/CriminaliteitCard.tsx` (181 lines) — Takes `CbsCriminaliteit` from `metrics.criminaliteit`.
- `frontend/src/components/projects/AgeDistributionCard.tsx` (101 lines) — Takes `CbsLeeftijdsVerdeling` from `metrics.data.leeftijdsverdeling`.
- `frontend/src/components/projects/IncomeCard.tsx` (122 lines) — Takes `CbsInkomen` from `metrics.data.inkomen`.
- `frontend/src/components/projects/HouseholdCard.tsx` (101 lines) — Takes `CbsHuishoudens` from `metrics.data.huishoudens`.
- `frontend/src/components/projects/JuridischKlimaatCard.tsx` (142 lines) — Takes doorlooptijd + winLoss from useJurisprudence hooks. Used in JurisprudenceSection.
- `frontend/src/hooks/useJurisprudence.ts` — Exports `useGemeenteAnalysis`, `useDoorlooptijdStats`, `useTrendData` for juridisch data. Already used by JurisprudenceSection in WijkMapPanel.
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` — Has aggregation logic (`aggregateMetrics`) that can be extracted/reused for inline gemeente CBS display.
- `frontend/src/routes/_authenticated/map.tsx` — Passes props to WijkMapPanel and GemeenteContextPanel. May need to pass additional scan data to WijkMapPanel.

### Patterns to Follow

1. **Pill tabs** — Both GemeenteContextPanel and ParcelDetailPanel use the same pill tab pattern: `div.flex.w-full.h-[48px].rounded-full.p-1.bg-[#F2F6F3]` with `motion.div layoutId` for active indicator. WijkMapPanel should adopt the same.
2. **KPI grid** — GemeenteContextPanel already has a 2×2 KpiCard grid. WijkMapPanel should add a similar grid. KpiCard pattern: `rounded-[24px] bg-white border border-[#EAEFEF] p-5`, icon + label top, large value bottom.
3. **Section headers** — Use `text-[10px] font-black text-slate-400 uppercase` with `letterSpacing: '0.2em'` and Plus Jakarta Sans. Both panels already use this.
4. **staggerContainer/fadeUp variants** — Both panels already use the same framer-motion stagger animations.
5. **CBS card embedding** — WijkDetailView already imports and renders all 6 CBS cards from `@/components/projects/`. Follow that exact pattern.

### Build Order

1. **WijkMapPanel first** — Simpler: single `latestScan.neighborhood_metrics` data source, no aggregation. Add pill tabs, KPI summary, and all 6 CBS cards. Verify visually.
2. **GemeenteContextPanel second** — More complex: aggregation across scanned wijken. Convert Demografie tab to show inline CBS aggregate data. Add juridisch klimaat summary to Overzicht. May extract `aggregateMetrics` from DemografieModal to a shared util.

### Verification Approach

- `cd frontend && npx tsc --noEmit` — zero errors
- Browser: click gemeente → panel shows KPI grid with real numbers (not just "—") when scans exist
- Browser: click wijk → panel shows pill tabs, KPI grid, CBS cards with real data from latest scan
- Browser: wijk panel Demografie tab shows all CBS breakdown cards inline
- Browser: gemeente panel Demografie tab shows aggregated CBS data inline (not just opens modal)
- Browser: modals still accessible from summary cards for drill-down
- ParcelDetailPanel unchanged (KNOWLEDGE.md hard rule)

## Constraints

- **ParcelDetailPanel and ParcelDetailModal are UNTOUCHED.** No changes to parcel components per KNOWLEDGE.md.
- WijkMapPanel data comes from `latestScan.neighborhood_metrics` passed from map.tsx — no new API calls needed.
- GemeenteContextPanel data comes from `scans[]` prop (already passed) — CBS aggregation is client-side across scanned wijken.
- CBS cards have existing null handling — they return null or show "—" when data is missing. No defensive coding needed beyond what exists.
- WijkMapPanel is rendered in LeftPanelShell (400px width) — CBS cards designed for wider layouts may need compact rendering. Check CbsNeighborhoodCard, CriminaliteitCard, NabijheidCard render acceptably at 400px (minus 64px padding = ~336px content width).

## Common Pitfalls

- **CbsNeighborhoodMetrics optional fields** — `nabijheid`, `criminaliteit`, `leeftijdsverdeling`, `huishoudens`, `inkomen` are all optional on the type. Guard with `metrics.nabijheid && <NabijheidCard />` pattern.
- **WijkMapPanel latestScan null** — When no completed scan exists, CBS section should not render (already handled by `hasCompletedScan` guard). New cards should be inside the same guard.
- **Gemeente aggregation on empty scans** — `aggregateMetrics` already handles empty scan arrays returning null. The existing DemografieModal empty state pattern ("Geen CBS data beschikbaar") should be followed for inline content too.
- **layoutId collision** — GemeenteContextPanel uses `layoutId="gemeente-tab"`, WijkMapPanel should use a distinct layoutId like `layoutId="wijk-tab"` to prevent cross-panel animation conflicts.
- **Panel width for cards** — CBS cards like CriminaliteitCard have category breakdowns with bars. At 336px content width (400px panel - 2×32px padding) these should render fine, but verify the stacked bar and legend don't overflow.
