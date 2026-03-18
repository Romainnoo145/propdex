# T01: Create modal shell and Demografie + Wijken modals

## Slice Context

**Goal:** Clicking summary cards in GemeenteContextPanel opens full-page modals with real data.

**Demo:** Click "Demografie" → modal with CBS stats. Click "Wijken" → modal with wijk cards and scan status. Close → back to panel.

## Description

Establishes the reusable GemeenteModal shell and delivers the two simpler modals (Demografie, Wijken). These don't require embedding complex existing components — Demografie fetches CBS data directly, Wijken expands the existing wijk list.

**Critical constraint:** ParcelDetailPanel.tsx MUST NOT be modified.

## Steps

1. Create `frontend/src/components/map/panels/gemeente/GemeenteModal.tsx`:
   - Full-page modal overlay: fixed inset-0, backdrop bg-black/40, centered content
   - Content area: max-w-3xl w-full, max-h-[85vh], overflow-y-auto, rounded-2xl, bg-white, shadow-2xl
   - Title bar: flex justify-between with h2 title and X close button
   - framer-motion: fade in overlay + scale up content
   - Escape key closes via onClose prop
   - Click backdrop closes
   - Props: `title: string`, `onClose: () => void`, `children: React.ReactNode`
   - z-index: var(--z-modal) or a high fixed value (1000)

2. Create `frontend/src/components/map/panels/gemeente/DemografieModal.tsx`:
   - Props: `gemeenteCode: string`, `gemeenteNaam: string`, `onClose: () => void`
   - Fetches CBS gemeente-level data. Check if there's a dedicated hook, otherwise create a simple `useGemeenteCbsData(gemeenteCode)` hook that calls the backend CBS endpoint for gemeente-level aggregated data.
   - If no gemeente-level CBS endpoint exists yet, use the existing `CbsNeighborhoodCard` component with gemeente-level metrics from any completed scan in that gemeente (fallback approach — show wijk aggregate data).
   - Display sections:
     - Hero: gemeente name + "Demografische gegevens"
     - Stats grid: Inwoners, Gem. WOZ-waarde, Stedelijkheid
     - Leeftijdsverdeling: horizontal bar chart (if data available)
     - Inkomen: mediaan, % laag/hoog
     - Huishoudens: totaal, % eenpersoons, % gezin
   - Fallback: "Geen CBS data beschikbaar voor deze gemeente" when all null

3. Create `frontend/src/components/map/panels/gemeente/WijkenModal.tsx`:
   - Props: `gemeenteNaam: string`, `wijkGeojson: GeoJSON.FeatureCollection | null`, `scannedWijkNames: string[]`, `scanHistory: { scans: ScanListItem[] } | undefined`, `gemeenteCode: string`, `onClose: () => void`, `onSelectWijk: (code: string, naam: string) => void`
   - Shows all wijken as cards in a grid (2-3 columns)
   - Each card shows: wijk name, scan status badge (gescand/niet gescand), parcel count from latest scan, last scan date
   - Clicking a wijk: close modal, call onSelectWijk
   - Sort: scanned wijken first, then alphabetical

4. Update `frontend/src/components/map/panels/GemeenteContextPanel.tsx`:
   - Add state: `const [openModal, setOpenModal] = useState<GemeenteCardCategory | null>(null)`
   - Replace `onCardClick` prop with internal state management: card click → `setOpenModal(category)`
   - Remove `onCardClick` from props interface
   - Render modal based on openModal state:
     - `openModal === 'demografie'` → `<DemografieModal gemeenteCode={code} gemeenteNaam={naam} onClose={() => setOpenModal(null)} />`
     - `openModal === 'wijken'` → `<WijkenModal ... onClose={() => setOpenModal(null)} onSelectWijk={(code, name) => { setOpenModal(null); onSelectWijk(code, name) }} />`
     - 'juridisch' and 'meldingen' → placeholder toast for now (T02)

5. Update `frontend/src/routes/_authenticated/map.tsx`:
   - Remove the `onCardClick` prop from GemeenteContextPanel (now internal)
   - Remove the toast handler

## Must-Haves

- GemeenteModal is a reusable full-page modal shell
- DemografieModal shows real CBS data (or graceful fallback)
- WijkenModal shows wijk list with scan status
- Modal close returns to gemeente panel
- GemeenteContextPanel manages modal state internally

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Manual: Click Demografie card → modal with CBS data. Click Wijken card → wijk cards. Close → panel visible. Click wijk in modal → wijk selected on map.

## Inputs

- GemeenteContextPanel.tsx from S02
- CbsNeighborhoodCard.tsx (reference for CBS data display)
- useScanHistory hook (for wijk scan status)
- CBS data hooks from useJurisprudence.ts or similar

## Expected Output

- `frontend/src/components/map/panels/gemeente/GemeenteModal.tsx` (~60 lines)
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` (~150 lines)
- `frontend/src/components/map/panels/gemeente/WijkenModal.tsx` (~120 lines)
- Updated GemeenteContextPanel.tsx (modal state, no more onCardClick prop)
- Updated map.tsx (removed onCardClick handler)

## Observability Impact

- **State inspection**: `openModal` state on GemeenteContextPanel reveals which modal is active (null = none). Inspect via React DevTools.
- **Fallback visibility**: DemografieModal renders explicit "Geen CBS data beschikbaar" when no completed scans exist — visible in UI without tooling.
- **Escape key handler**: GemeenteModal registers/deregisters `keydown` on mount/unmount. A stale listener would prevent close — check DOM event listeners if escape stops working.
- **Portal rendering**: Modals use `createPortal(document.body)` — inspectable in DOM root outside the React tree.
