# T02: GemeenteContextPanel inline CBS content and shared aggregation util

## Description

Transform GemeenteContextPanel's Demografie tab from a modal-opener into inline CBS aggregate cards. Extract `aggregateMetrics` from DemografieModal into a shared utility. Add JuridischKlimaatCard to the Overzicht tab. After this task, users see real CBS data directly in the gemeente panel without needing to click into a modal.

## Context

- **Slice goal:** Data-first panel content for gemeente and wijk panels
- **Prior task:** T01 added pill tabs and CBS cards to WijkMapPanel
- **This task:** GemeenteContextPanel inline content (more complex — aggregation across wijken)

## Inputs

- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` (347 lines) — has pill tabs (overzicht/demografie/wijken), 2×2 KPI grid, Demografie tab currently opens DemografieModal
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` — contains `aggregateMetrics()`, `avg()`, `sum()` helper functions and `AggregatedMetrics` type that must be extracted
- CBS card components in `frontend/src/components/projects/` — same cards as T01

### Current Demografie Tab Behavior

In GemeenteContextPanel, the Demografie tab currently triggers:
```tsx
if (tab === 'demografie') {
  setOpenModal('demografie')  // Opens DemografieModal instead of showing tab content
}
```

This needs to change to actually show inline CBS content on the Demografie tab, with a "Meer details" button that opens the modal for drill-down.

### aggregateMetrics Location

In `DemografieModal.tsx` (line ~104), there's a local `aggregateMetrics(all: CbsNeighborhoodMetrics[]): AggregatedMetrics` function along with `avg()` and `sum()` helpers. The `AggregatedMetrics` type is also defined there (~line 80-100). These need extraction to `frontend/src/lib/utils/cbs-aggregation.ts`.

### JuridischKlimaatCard

`frontend/src/components/projects/JuridischKlimaatCard.tsx` (142 lines) takes doorlooptijd and winLoss data from `useGemeenteAnalysis` / `useDoorlooptijdStats` hooks in `frontend/src/hooks/useJurisprudence.ts`.

Check how JuridischKlimaatCard is used in JurisprudenceSection to understand its props pattern.

## Steps

1. **Read** `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` to understand the full `aggregateMetrics` function, `AggregatedMetrics` type, and `avg`/`sum` helpers.

2. **Read** `frontend/src/components/projects/JuridischKlimaatCard.tsx` and check its props interface. Also check how it's used in `JurisprudenceSection.tsx` to understand what hooks/data it needs.

3. **Create shared aggregation util** at `frontend/src/lib/utils/cbs-aggregation.ts`:
   - Extract `AggregatedMetrics` interface
   - Extract `aggregateMetrics(all: CbsNeighborhoodMetrics[]): AggregatedMetrics` function
   - Extract `avg(values: (number | null | undefined)[]): number` helper
   - Extract `sum(values: (number | null | undefined)[]): number` helper
   - Export all of them

4. **Update DemografieModal.tsx** to import from shared util:
   - Remove local `aggregateMetrics`, `avg`, `sum`, `AggregatedMetrics` definitions
   - Add `import { aggregateMetrics, type AggregatedMetrics } from '@/lib/utils/cbs-aggregation'`
   - Verify DemografieModal still renders correctly (no logic change, just import source change)

5. **Update GemeenteContextPanel.tsx Demografie tab**:
   - Import aggregation util: `import { aggregateMetrics, type AggregatedMetrics } from '@/lib/utils/cbs-aggregation'`
   - Import CBS cards: `AgeDistributionCard`, `IncomeCard`, `HouseholdCard` (and optionally `CbsNeighborhoodCard`)
   - Change `handleSelectTab` to NOT open modal for 'demografie' — just `setActiveTab(tab)` for all tabs
   - Compute aggregated metrics via useMemo:
     ```tsx
     const aggregated = useMemo(() => {
       const gemeenteScans = scans.filter(s => s.status === 'completed' && s.neighborhood_metrics)
       if (gemeenteScans.length === 0) return null
       return aggregateMetrics(gemeenteScans.map(s => s.neighborhood_metrics!))
     }, [scans])
     ```
   - Add Demografie tab content showing aggregated CBS cards:
     - AgeDistributionCard (if leeftijd data exists, map aggregated percentages to CbsLeeftijdsVerdeling shape)
     - IncomeCard (if inkomen data exists)
     - HouseholdCard (if huishoudens data exists)
     - Empty state: "Geen CBS data beschikbaar — scan een wijk om demografische data te laden"
     - "Meer details" button at bottom that opens DemografieModal (`setOpenModal('demografie')`)

   **Important:** The aggregated data from `aggregateMetrics` returns a custom `AggregatedMetrics` shape, NOT the raw `CbsLeeftijdsVerdeling`/`CbsInkomen`/`CbsHuishoudens` types. Check if the CBS cards can accept the aggregated shape, or if you need to map the aggregated data back to the CBS card prop types. If mapping is complex, render a simplified inline summary (KPI-style numbers) instead of the full CBS cards, and keep the modal for the detailed card views.

6. **Add JuridischKlimaatCard to Overzicht tab**:
   - Import JuridischKlimaatCard and required hooks (check what props it needs)
   - Add below the existing 2×2 KPI grid on the Overzicht tab
   - Guard with data availability check
   - Use the gemeente code already available in the component (`code` prop)

7. **Verify**: `cd frontend && npx tsc --noEmit` — zero errors.

## Must-Haves

- `aggregateMetrics` extracted to shared util, DemografieModal imports from it
- Demografie tab shows inline CBS aggregate content (not just opens modal)
- "Meer details" button on Demografie tab opens DemografieModal for drill-down
- JuridischKlimaatCard rendered on Overzicht tab
- Empty state when no scanned wijken have CBS data
- No changes to ParcelDetailPanel or ParcelDetailModal
- DemografieModal continues to work unchanged (just import source changed)

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Browser (manual, requires dev server + backend):
- Click gemeente with scanned wijken → Demografie tab shows aggregated CBS data inline
- Click gemeente without scans → Demografie tab shows empty state message
- "Meer details" button on Demografie tab → opens DemografieModal (drill-down works)
- Overzicht tab shows JuridischKlimaatCard with gemeente analysis
- All 4 summary card modals still work (no regression)

## Expected Output

- `frontend/src/lib/utils/cbs-aggregation.ts` — new shared util (~60-80 lines)
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` — reduced (aggregation logic extracted)
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — expanded with inline CBS content on Demografie tab, JuridischKlimaatCard on Overzicht tab
- TypeScript compiles clean
