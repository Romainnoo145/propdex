# T01: Extract useMapPanels hook from map.tsx

## Slice Context

**Goal:** Panel orchestration extracted from map.tsx into useMapPanels hook. All existing panel interactions work identically after extraction.

**Demo:** All panel transitions (gemeente click → panel, wijk select, wijk back, parcel click, close) work exactly as before. map.tsx is ~80-100 lines shorter.

## Description

map.tsx is 2,373 lines with ~20 setActivePanel calls. The ActivePanel union type and panel navigation handlers (gemeente↔wijk transitions, close handlers) are self-contained enough to extract into a hook. This reduces map.tsx complexity and creates a clean contract boundary for S02-T02 to build on.

**Scope boundaries:**
- Extract: ActivePanel type, activePanel state, inspectorParcel derived state, panel navigation handlers (handleGemeentePanelSelectWijk, handleWijkPanelBack, close handlers)
- Keep inline: parcel-opening setActivePanel calls (they depend on many local variables in click handler closures — extracting them would require threading 15+ dependencies)
- The hook exposes `setActivePanel` so map.tsx can still set parcel panels directly

**Critical constraint:** ParcelDetailPanel.tsx MUST NOT be modified (KNOWLEDGE.md hard rule).

## Steps

1. Create `frontend/src/hooks/useMapPanels.ts`:
   - Export the `ActivePanel` union type (moved from map.tsx)
   - Hook params interface with required refs and callbacks:
     ```ts
     interface UseMapPanelsParams {
       activeGemeenteRef: React.RefObject<{ code: string; naam: string; bbox: [number, number, number, number] } | null>
       wijkGeojson: GeoJSON.FeatureCollection | null
       scanHistory: { scans: ScanListItem[] } | undefined
       mapRef: React.RefObject<maplibregl.Map | null>
       setActiveGemeente: (g: { code: string; naam: string; bbox: [number, number, number, number] } | null) => void
       setWijkGeojson: (g: GeoJSON.FeatureCollection | null) => void
       setParcelGeometryHighlight: (h: ParcelGeometryHighlight | null) => void
       removeWijkBoundariesLayer: (map: maplibregl.Map) => void
       removeScanAreaHighlight: (map: maplibregl.Map) => void
       addScanAreaHighlight: (map: maplibregl.Map, geom: GeoJSON.Geometry) => void
     }
     ```
   - Internal state: `const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)`
   - Derived: `const inspectorParcel = activePanel?.kind === 'parcel' ? activePanel.parcel : null`
   - `handleGemeentePanelSelectWijk(wijkCode, wijkNaam)` — finds wijk feature, highlights, transitions to wijk panel
   - `handleWijkPanelBack()` — transitions back to gemeente panel
   - `handleCloseGemeentePanel()` — closes panel, clears gemeente, removes wijk layer, resets map view
   - `handleCloseParcelPanel()` — closes panel, clears geometry highlight
   - Return: `{ activePanel, setActivePanel, inspectorParcel, handleGemeentePanelSelectWijk, handleWijkPanelBack, handleCloseGemeentePanel, handleCloseParcelPanel }`

2. Update `frontend/src/routes/_authenticated/map.tsx`:
   - Remove ActivePanel type definition (now imported from hook)
   - Remove `const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)`
   - Remove `const inspectorParcel = activePanel?.kind === 'parcel' ? activePanel.parcel : null`
   - Remove `handleGemeentePanelSelectWijk`, `handleWijkPanelBack` useCallback definitions
   - Import and destructure from useMapPanels
   - Keep all `setActivePanel({ kind: 'parcel', ... })` calls as-is (using the exposed setter)
   - Keep all `setActivePanel(null)` calls that are inside parcel-related handlers
   - Update the gemeente panel close handler in JSX to use `handleCloseGemeentePanel`
   - Update the parcel panel close handler to use `handleCloseParcelPanel`
   - Import NL_CENTER and NL_ZOOM constants (used by handleCloseGemeentePanel — check if they're already exported or need to be)

3. Verify no behavioral changes:
   - All existing panel open/close transitions work
   - Wijk selection from gemeente panel works
   - Back navigation from wijk to gemeente works
   - Parcel selection closes other panels

## Must-Haves

- ActivePanel type exported from useMapPanels.ts
- Hook manages activePanel state and panel navigation handlers
- map.tsx uses the hook instead of direct state
- All existing panel interactions work identically
- No TypeScript errors

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Manual: click gemeente → panel opens. Select wijk → wijk panel. Back → gemeente panel. Close → panel gone. Click parcel → parcel panel. All transitions work as before.

## Inputs

- Current map.tsx (2,373 lines) with ActivePanel type at line 101, state at line 237, handlers at lines 2074-2130
- MapPanelShell.tsx for reference (right-side positioning)
- ScanListItem type for latestScan in wijk panel

## Observability Impact

- **New inspection surface:** `useMapPanels` hook state visible in React DevTools — shows `activePanel` object with `kind` discriminator (`gemeente` | `wijk` | `parcel` | null)
- **Failure diagnosis:** If a panel doesn't open, check `activePanel` state in devtools. If transitions fail, verify the hook's dependencies (activeGemeenteRef, wijkGeojson, mapRef) are populated.
- **No logging added:** Panel state transitions are purely in-memory React state. Add `console.debug` in handlers if runtime tracing is needed.

## Expected Output

- `frontend/src/hooks/useMapPanels.ts` (~120-150 lines)
- map.tsx reduced by ~80-100 lines
- All panel interactions unchanged
