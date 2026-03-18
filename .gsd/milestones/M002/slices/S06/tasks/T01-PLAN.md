# T01: WijkMapPanel data-first redesign with pill tabs and CBS cards

## Description

Transform WijkMapPanel from a simple scan-status + single-card view into a tabbed data-first panel with KPI grid, all 6 CBS breakdown cards, and organized tab sections. Currently the panel (177 lines) renders CbsNeighborhoodCard and JurisprudenceSection inline without tabs. After this task, it has 3 pill tabs (Overzicht/Demografie/Juridisch), a KPI summary grid, and all CBS cards wired to `latestScan.neighborhood_metrics`.

## Context

- **Slice goal:** Data-first panel content for gemeente and wijk panels
- **This task:** WijkMapPanel redesign (simpler — single data source from latestScan)
- **Next task:** T02 handles GemeenteContextPanel with aggregation across wijken

## Inputs

- `frontend/src/components/map/panels/WijkMapPanel.tsx` (177 lines) — current component
- `frontend/src/components/map/panels/parcel/CategoryTabs.tsx` (52 lines) — pill tab pattern reference
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — has the pill tab implementation pattern (copy layout, use layoutId="wijk-tab" NOT "gemeente-tab")

### Pill Tab Pattern (from GemeenteContextPanel)

The pill tab pattern uses:
```tsx
// Container
<div className="flex w-full h-[48px] rounded-full p-1 bg-[#F2F6F3]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
  {TABS.map(({ key, label }) => {
    const isActive = activeTab === key
    return (
      <button key={key} onClick={() => setActiveTab(key)}
        className="relative flex-1 h-full rounded-full text-[13px] font-bold tracking-tight transition-colors z-10 ..."
      >
        {isActive && <motion.div layoutId="wijk-tab" className="absolute inset-0 rounded-full bg-white shadow-sm" ... />}
        <span className="relative z-10">{label}</span>
      </button>
    )
  })}
</div>
```

### CBS Card Props

Each CBS card takes data from `latestScan.neighborhood_metrics`:
- `CbsNeighborhoodCard` — `metrics: CbsNeighborhoodMetrics` (full metrics object)
- `NabijheidCard` — `nabijheid: CbsNabijheid` (from `metrics.nabijheid`)
- `CriminaliteitCard` — `criminaliteit: CbsCriminaliteit` (from `metrics.criminaliteit`)
- `AgeDistributionCard` — `leeftijdsverdeling: CbsLeeftijdsVerdeling` (from `metrics.data.leeftijdsverdeling`)
- `IncomeCard` — `inkomen: CbsInkomen` + optional `wozWaarde: number` (from `metrics.data.inkomen`, `metrics.data.gemiddelde_woz_waarde`)
- `HouseholdCard` — `huishoudens: CbsHuishoudens` + optional `leeftijdsverdeling: CbsLeeftijdsVerdeling` (from `metrics.data.huishoudens`, `metrics.data.leeftijdsverdeling`)

All optional fields — guard with `metrics.nabijheid && <NabijheidCard nabijheid={metrics.nabijheid} />`.

### KPI Grid Pattern (from GemeenteContextPanel)

```tsx
<div className="grid grid-cols-2 gap-3">
  <KpiCard icon={<Users ... />} label="Inwoners" value={...} />
  <KpiCard icon={<Home ... />} label="Gem. WOZ" value={...} />
  ...
</div>
```

KpiCard pattern: `rounded-[24px] bg-white border border-[#EAEFEF] p-5`, icon + label top, large value bottom.

## Steps

1. **Read** `frontend/src/components/map/panels/WijkMapPanel.tsx` fully to understand current structure.

2. **Add imports** for new CBS cards and tab state:
   - `import { useState } from 'react'`
   - `import { NabijheidCard } from '@/components/projects/NabijheidCard'`
   - `import { CriminaliteitCard } from '@/components/projects/CriminaliteitCard'`
   - `import { AgeDistributionCard } from '@/components/projects/AgeDistributionCard'`
   - `import { IncomeCard } from '@/components/projects/IncomeCard'`
   - `import { HouseholdCard } from '@/components/projects/HouseholdCard'`
   - Add `Users, Home, MapPin` (or similar) from lucide-react for KPI icons

3. **Add tab state and types** inside the component:
   ```tsx
   type WijkTab = 'overzicht' | 'demografie' | 'juridisch'
   const TABS: { key: WijkTab; label: string }[] = [
     { key: 'overzicht', label: 'Overzicht' },
     { key: 'demografie', label: 'Demografie' },
     { key: 'juridisch', label: 'Juridisch' },
   ]
   const [activeTab, setActiveTab] = useState<WijkTab>('overzicht')
   ```

4. **Add pill tabs** inside the `hasCompletedScan` block, ABOVE the existing content. Use the exact pill tab pattern from GemeenteContextPanel but with `layoutId="wijk-tab"` (NOT "gemeente-tab" — CRITICAL to avoid cross-panel animation conflicts).

5. **Add KPI grid** to the Overzicht tab content. Extract values from `latestScan`:
   - Inwoners: `latestScan.neighborhood_metrics?.data?.demografie?.aantal_inwoners`
   - Gem. WOZ: `latestScan.neighborhood_metrics?.data?.gemiddelde_woz_waarde` (format as €xxx.xxx)
   - Percelen: `latestScan.parcels_total`
   - Score: `latestScan.neighborhood_metrics?.data?.demografie?.percentage_koopwoningen` (or similar meaningful metric)

   Create a local `KpiCard` component (or inline the pattern) matching the GemeenteContextPanel style: `rounded-[24px] bg-white border border-[#EAEFEF] p-5`.

6. **Move existing CbsNeighborhoodCard to Overzicht tab** (keep it as the main overview card). Move JurisprudenceSection to the Juridisch tab.

7. **Build Demografie tab** with all 6 CBS cards in a scrollable vertical stack:
   ```tsx
   {activeTab === 'demografie' && latestScan.neighborhood_metrics && (
     <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
       <motion.div variants={fadeUp}><CbsNeighborhoodCard metrics={latestScan.neighborhood_metrics} /></motion.div>
       {latestScan.neighborhood_metrics.nabijheid && (
         <motion.div variants={fadeUp}><NabijheidCard nabijheid={latestScan.neighborhood_metrics.nabijheid} /></motion.div>
       )}
       {latestScan.neighborhood_metrics.criminaliteit && (
         <motion.div variants={fadeUp}><CriminaliteitCard criminaliteit={latestScan.neighborhood_metrics.criminaliteit} /></motion.div>
       )}
       {latestScan.neighborhood_metrics.data.leeftijdsverdeling && (
         <motion.div variants={fadeUp}><AgeDistributionCard leeftijdsverdeling={latestScan.neighborhood_metrics.data.leeftijdsverdeling} /></motion.div>
       )}
       {latestScan.neighborhood_metrics.data.inkomen && (
         <motion.div variants={fadeUp}><IncomeCard inkomen={latestScan.neighborhood_metrics.data.inkomen} wozWaarde={latestScan.neighborhood_metrics.data.gemiddelde_woz_waarde} /></motion.div>
       )}
       {latestScan.neighborhood_metrics.data.huishoudens && (
         <motion.div variants={fadeUp}><HouseholdCard huishoudens={latestScan.neighborhood_metrics.data.huishoudens} leeftijdsverdeling={latestScan.neighborhood_metrics.data.leeftijdsverdeling} /></motion.div>
       )}
     </motion.div>
   )}
   ```

8. **Build Juridisch tab** — move JurisprudenceSection here (it's currently rendered inline at bottom):
   ```tsx
   {activeTab === 'juridisch' && (
     <motion.div variants={fadeUp} initial="hidden" animate="show">
       <JurisprudenceSection gemeenteCode={/* get from latestScan or props */} wijkNaam={naam} />
     </motion.div>
   )}
   ```
   Note: Check how JurisprudenceSection is currently invoked in WijkMapPanel for its exact props.

9. **Preserve non-scan state**: When `!hasCompletedScan`, keep the existing scan-start UI unchanged. Tabs only appear when there's a completed scan with data.

10. **Verify**: `cd frontend && npx tsc --noEmit` — zero errors.

## Must-Haves

- Pill tabs with 3 sections, using layoutId="wijk-tab"
- KPI grid with real values from latestScan
- All 6 CBS cards on Demografie tab with null guards
- JurisprudenceSection on Juridisch tab (not removed, just moved)
- Existing no-scan state preserved
- staggerContainer/fadeUp animations used consistently
- No changes to ParcelDetailPanel or ParcelDetailModal

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Browser (manual, requires dev server + backend):
- Click wijk with completed scan → 3 pill tabs visible
- Overzicht tab: KPI grid with numbers, CbsNeighborhoodCard
- Demografie tab: All available CBS cards rendered
- Juridisch tab: JurisprudenceSection renders
- Click wijk without completed scan → scan start UI (no tabs)

## Expected Output

- `frontend/src/components/map/panels/WijkMapPanel.tsx` — expanded from 177 to ~300-350 lines with pill tabs, KPI grid, 6 CBS cards across 3 tabs
- TypeScript compiles clean

## Observability Impact

- **New signals:** CBS card sections appear/disappear based on `neighborhood_metrics` sub-field availability — absent sections indicate missing data, not a bug
- **Inspection:** React DevTools → `activeTab` state on WijkMapPanel shows current tab. KPI cards show "—" when metrics fields are null.
- **Failure visibility:** If all CBS cards on Demografie tab are absent, `latestScan.neighborhood_metrics` is null — check scan backend for CBS data fetch failures
