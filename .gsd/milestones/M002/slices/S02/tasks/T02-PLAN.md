# T02: Create GemeenteContextPanel with summary cards on left side

## Slice Context

**Goal:** GemeenteContextPanel replaces GemeenteMapPanel. Renders on the LEFT side (~400px) with 4 summary cards (Demografie, Juridisch Klimaat, Meldingen, Wijken) plus the wijk list.

**Demo:** Click gemeente boundary → left panel slides in with gemeente name, 4 summary cards, and wijk list. Click summary card → toast placeholder. Select wijk → WijkMapPanel opens. Parcel panel still works on right.

## Description

Replace the existing right-side GemeenteMapPanel with a left-side GemeenteContextPanel that has summary cards. Create LeftPanelShell for left-side positioning (distinct from MapPanelShell which positions right and ParcelPanelShell which uses the portal).

**Critical constraint:** ParcelDetailPanel.tsx MUST NOT be modified (KNOWLEDGE.md hard rule).

## Steps

1. Create `frontend/src/components/map/panels/LeftPanelShell.tsx`:
   - Desktop: `fixed left-[112px] top-4 bottom-4 w-[400px]` (80px side rail + 32px gap)
   - Mobile: `fixed inset-x-0 bottom-0 max-h-[72vh]` (bottom sheet, same pattern as MapPanelShell mobile)
   - z-index: `calc(var(--z-map-controls) + 2)` (same as MapPanelShell)
   - Styling: `rounded-[24px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]` (matches ParcelPanelShell Aura glass)
   - Escape key handler (same pattern as MapPanelShell)
   - Entry animation: slide in from left with opacity (framer-motion)
   - Props: `children`, `onClose`

2. Create `frontend/src/components/map/panels/GemeenteContextPanel.tsx`:
   - Uses LeftPanelShell for positioning
   - Props:
     ```ts
     interface GemeenteContextPanelProps {
       naam: string
       code: string
       wijkGeojson: GeoJSON.FeatureCollection | null
       scannedWijkNames: string[]
       onClose: () => void
       onSelectWijk: (wijkCode: string, wijkNaam: string) => void
       onCardClick: (category: 'demografie' | 'juridisch' | 'meldingen' | 'wijken') => void
     }
     ```
   - Layout:
     - Header: gemeente name (h2) + subtitle "Gemeente" + close button (X icon)
     - Stats bar: wijk count badge + scanned count badge (same as current GemeenteMapPanel)
     - Summary cards grid (2×2 on desktop, stacked on mobile):
       - **Demografie** — Users icon, "Demografie", "Bevolkingsopbouw en statistieken", onClick → onCardClick('demografie')
       - **Juridisch Klimaat** — Scale icon, "Juridisch Klimaat", "Vergunningen en jurisprudentie", onClick → onCardClick('juridisch')
       - **Meldingen** — Bell icon, "Meldingen", "Bestemmingsplanwijzigingen", onClick → onCardClick('meldingen')
       - **Wijken** — MapPin icon, `${wijkCount} wijken`, "Wijkoverzicht en scans", onClick → scroll to wijk list OR onCardClick('wijken')
     - Each card: `rounded-xl border border-white/30 bg-white/40 p-4 hover:bg-white/60 cursor-pointer transition-all` with icon, title, description
     - Divider
     - Wijk list: same as current GemeenteMapPanel but in card style, with scanned badge per wijk
   - Icons from lucide-react: Users, Scale, Bell, MapPin, X

3. Update `frontend/src/routes/_authenticated/map.tsx`:
   - Replace `<GemeenteMapPanel>` import and usage with `<GemeenteContextPanel>`
   - Add `code={activePanel.code}` prop
   - Add `onCardClick` handler: `(category) => toast.info(\`\${category} — komt in S03\`)` as placeholder
   - Use `handleCloseGemeentePanel` from useMapPanels (from T01)

4. Delete `frontend/src/components/map/panels/GemeenteMapPanel.tsx` (fully replaced)

5. Verify:
   - Left panel appears on gemeente click
   - Right panel (ParcelDetailPanel) still works
   - Summary cards render with icons and descriptions
   - Wijk selection still works
   - Mobile: bottom sheet layout works

## Must-Haves

- LeftPanelShell positions panel on left side (not right)
- 4 summary cards with icons, titles, descriptions
- Summary card onClick fires (toast placeholder for now)
- Wijk list preserved from GemeenteMapPanel
- ParcelDetailPanel unaffected
- Mobile bottom sheet fallback
- Escape closes panel

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Manual verification:
- Click gemeente → left panel with 4 summary cards + wijk list
- Click summary card → toast appears
- Select wijk → WijkMapPanel opens (right side, MapPanelShell)
- Click parcel → left panel closes, ParcelDetailPanel opens (right side, portal)
- Escape → active panel closes
- Mobile: bottom sheet for gemeente panel

## Inputs

- useMapPanels hook from T01
- Current GemeenteMapPanel.tsx (wijk list logic to preserve)
- MapPanelShell.tsx (reference for shell pattern)
- ParcelPanelShell.tsx (reference for Aura glass styling)

## Expected Output

- `frontend/src/components/map/panels/LeftPanelShell.tsx` (~50-70 lines)
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` (~150-200 lines)
- Updated map.tsx with GemeenteContextPanel replacing GemeenteMapPanel
- GemeenteMapPanel.tsx deleted

## Observability Impact

- **Panel state transitions**: `activePanel.kind === 'gemeente'` in React DevTools on the `useMapPanels` hook signals GemeenteContextPanel is mounted.
- **Card click modals**: `openModal` local state in GemeenteContextPanel tracks which summary card modal is open (demografie/juridisch/meldingen/wijken or null).
- **Failure visibility**: If the left panel doesn't appear after clicking a gemeente, check `activePanel` state in DevTools — if `kind !== 'gemeente'`, the click handler in map.tsx isn't setting it. If the panel mounts but is invisible, check z-index and left positioning in LeftPanelShell.
- **Escape key**: LeftPanelShell registers a global keydown listener — if Escape doesn't close the panel, check that `onClose` prop is wired.
