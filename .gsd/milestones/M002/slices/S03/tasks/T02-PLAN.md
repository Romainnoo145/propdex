# T02: Juridisch Klimaat + Meldingen modals, kill /meldingen route

## Slice Context

**Goal:** Complete all 4 gemeente modals. Embed the meldingen feed in a modal. Kill /meldingen standalone route.

**Demo:** Click "Juridisch Klimaat" → modal with jurisprudence analysis. Click "Meldingen" → modal with infinite-scroll feed. /meldingen → redirects to /map.

## Description

These two modals embed existing complex components. JuridischKlimaatModal wraps the existing JurisprudenceSection component. MeldingenModal is the hardest — it needs to preserve the infinite scroll, read tracking, and filtering from the 1,195-line meldingen.tsx route.

**Critical constraint:** ParcelDetailPanel.tsx MUST NOT be modified.

## Steps

1. Create `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx`:
   - Props: `gemeenteNaam: string`, `gemeenteCode: string`, `onClose: () => void`
   - Uses GemeenteModal shell from T01
   - Embeds existing `JurisprudenceSection` component with `gemeenteNaam={gemeenteNaam}` and `wijkNaam={null}` (gemeente-level analysis)
   - JurisprudenceSection already handles its own data fetching via hooks:
     - `useGemeenteRulingsFeed` — ruling feed
     - `useGemeenteAnalysis` — win/loss analysis
     - `useDoorlooptijdStats` — processing time stats
     - `useTrendData` — monthly trend
   - Also render `JuridischKlimaatCard` if available (check if it accepts gemeente-level props)
   - Minimal wrapper — the existing component does the heavy lifting

2. Create `frontend/src/components/map/panels/gemeente/MeldingenModal.tsx`:
   - Props: `gemeenteNaam: string`, `gemeenteCode: string`, `onClose: () => void`
   - Uses GemeenteModal shell from T01
   - Core functionality from meldingen.tsx to preserve:
     - `useInfiniteAllChanges(true, gemeenteNaam)` for gemeente-filtered data
     - `useReadTracking()` for read state
     - `useMarkAllRead()` for mark-all action
     - Timeline grouping by date
     - IntersectionObserver sentinel for infinite scroll
     - Change card rendering (category badge, address, date, match pill)
     - Click on change → navigate to map with parcel/address
   - Strategy: Extract the essential rendering (~200-300 lines) from meldingen.tsx. Don't copy the full 1,195 lines — the standalone page has ResultsShell wrapper, header, filter controls, and mobile layout that aren't needed in modal context.
   - Key pieces to extract:
     - `formatTimelineDateLabel()` utility
     - Timeline grouping logic (`useMemo` that groups changes by date)
     - Change card component (inline in meldingen.tsx — extract or duplicate)
     - IntersectionObserver ref pattern for infinite scroll
     - Read tracking integration
   - Header in modal: "Meldingen · {gemeenteNaam}" + "Alles gelezen" button
   - No gemeente filter dropdown needed (already filtered by prop)

3. Update `frontend/src/components/map/panels/GemeenteContextPanel.tsx`:
   - Add modal rendering for 'juridisch' and 'meldingen' categories (previously toast placeholders)
   - Pass required props to each modal (gemeenteCode, gemeenteNaam from panel props)

4. Rewrite `frontend/src/routes/_authenticated/meldingen.tsx` as redirect stub:
   ```tsx
   import { createFileRoute, redirect } from '@tanstack/react-router'

   /**
    * Redirect stub — /meldingen moved to gemeente modal in M002-S03.
    */
   export const Route = createFileRoute('/_authenticated/meldingen')({
     beforeLoad: () => {
       throw redirect({ to: '/map' })
     },
   })
   ```
   - This kills the standalone route while keeping internal references working via redirect
   - Note: SideRailNav already removed the Meldingen nav item in S01

5. Clean up unused imports in meldingen.tsx after rewrite (all the hook imports, component imports, etc.)

## Must-Haves

- JuridischKlimaatModal renders jurisprudence analysis via existing JurisprudenceSection
- MeldingenModal has infinite scroll, read tracking, date-grouped timeline
- /meldingen redirects to /map (not 404)
- All 4 modals accessible from GemeenteContextPanel
- Modal close returns to gemeente panel
- ParcelDetailPanel unchanged

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Manual:
- Click Juridisch Klimaat card → modal with analysis data
- Click Meldingen card → modal with feed, scroll loads more
- Navigate to /meldingen → redirected to /map
- All 4 modals open and close correctly
- Click change in meldingen modal → navigates to map

## Inputs

- GemeenteModal shell from T01
- JurisprudenceSection component (frontend/src/components/projects/JurisprudenceSection.tsx)
- JuridischKlimaatCard component (frontend/src/components/projects/JuridischKlimaatCard.tsx)
- useInfiniteAllChanges, useMarkAllRead, useReadTracking hooks
- meldingen.tsx for feed rendering reference (extract, don't copy wholesale)

## Expected Output

- `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx` (~50-80 lines — thin wrapper)
- `frontend/src/components/map/panels/gemeente/MeldingenModal.tsx` (~250-350 lines — feed rendering)
- Updated GemeenteContextPanel.tsx (all 4 modals wired)
- meldingen.tsx rewritten as redirect stub
- Clean TypeScript compilation
