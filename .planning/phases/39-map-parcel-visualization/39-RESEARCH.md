# Phase 39: Map Parcel Visualization - Research

**Researched:** 2026-02-19
**Domain:** MapLibre GL JS, PostGIS MVT tiles, React state management, CBS WFS GeoJSON
**Confidence:** HIGH

## Summary

Phase 39 is the map visualization layer for v5.0 Scan Intelligence. Its goal is to show users
which wijken have been scanned (MAP-01), render individual scan result parcels as score-colored
polygons (MAP-02), and give users a toggle to show/hide the parcel score overlay (MAP-03).

Critically, the core MVT tile infrastructure for MAP-02 is **already fully built**. The backend
has `GET /api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf` (scans router, line 705) that generates
PostGIS MVT tiles with `score` and `score_category` as tile properties. The frontend has
`ParcelScoreLayer.tsx` with `addParcelScoreLayer()`, `removeParcelScoreLayer()`, and
`setParcelScoreVisibility()`. The map page already calls `addParcelScoreLayer()` on scan
completion. What is MISSING: (1) the score layer is loaded but there is no toggle to
show/hide it, (2) scanned wijken have no distinct highlight (they use the same CBS wijk GeoJSON
already in memory, but no separate "scanned" styling layer exists), and (3) when the user
navigates to the map from scan history via `?scan_id=...`, the parcel score layer is currently
NOT restored (the existing `useEffect` only triggers on `scanStatus.data.status === 'completed'`
from active polling — a restored scan_id has no polling status to trigger it).

The architectural approach for MAP-01 is to filter the already-fetched CBS wijk GeoJSON (in
`wijkGeojson` state) against completed scan history from `useScanHistory()` to identify which
wijken have been scanned, then render a separate `ScannedWijkHighlightLayer.tsx` for those
features using a distinct color (amber or blue-tinted, visually distinct from the emerald green
of unscanned wijken in `WijkBoundariesLayer`).

**Primary recommendation:** Build three targeted additions: (1) a new `ScannedWijkHighlightLayer`
function that overlays scanned wijken in amber, (2) a toggle button in `LayerToggle.tsx` for the
parcel score layer (visible only when a scan is active/restored), and (3) a `useEffect` in
`map.tsx` that restores the parcel score layer when `urlScanId` is present — mirroring the
existing scan-completion trigger.

## Standard Stack

### Core (No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | Already installed | Layer/source management | Project map standard |
| @tanstack/react-query | ^5.90.20 | `useScanHistory` for scanned wijk names | Already used throughout |
| React | ^19.2.0 | State and effect hooks | Project standard |

### Supporting (Already In Codebase)
| File | Purpose | When to Use |
|------|---------|-------------|
| `ParcelScoreLayer.tsx` | Add/remove/toggle parcel MVT score layer | MAP-02, MAP-03 |
| `WijkBoundariesLayer.tsx` | CBS wijk GeoJSON source (already loaded into `wijkGeojson` state) | MAP-01 baseline |
| `MonitoredWijkOverlay.tsx` | Pattern to follow for filtered GeoJSON overlay | MAP-01 implementation |
| `LayerToggle.tsx` | Add score toggle button | MAP-03 |
| `useScans.ts` / `useScanHistory` | Fetch scan history for scanned wijk names | MAP-01 |
| `getScanTileUrl()` in `api.ts` | Build tile URL from scan ID | MAP-02 restoration |

**Installation:** No new npm packages needed. No new Python packages needed.

## Architecture Patterns

### Recommended File Changes

No new routes. Minimal new files — one new helper function module for MAP-01.

```
frontend/src/
├── components/map/
│   ├── ParcelScoreLayer.tsx     # Existing — setParcelScoreVisibility already exists; no changes needed
│   ├── LayerToggle.tsx          # Add score toggle button (prop + state)
│   └── ScannedWijkHighlightLayer.tsx  # NEW: highlight layer for scanned wijken
└── routes/_authenticated/
    └── map.tsx                  # Wire: score toggle, scanned wijk overlay, scan_id restoration

backend/app/services/
└── tile_proxy.py                # NO CHANGES NEEDED (tile query already returns score)
```

### Pattern 1: Scanned Wijk Highlight Layer (MAP-01)

Follow the exact same pattern as `MonitoredWijkOverlay.tsx`:

- Filter `wijkGeojson.features` where `statnaam` appears in the list of scanned wijk names
- Add a `geojson` source with filtered features
- Use amber fill (e.g. `rgba(245, 158, 11, 0.25)`) to visually distinguish from unscanned (emerald `#10b981`)
- Use amber border (e.g. `rgba(245, 158, 11, 0.7)`) at line-width 2
- Insert BEFORE `wijk-fill` layer so unscanned borders render on top

Data source for scanned wijk names: query `GET /api/scans` (already available via `useScanHistory`) and extract `wijk_naam` from completed scans for the same gemeente.

```typescript
// Source: MonitoredWijkOverlay.tsx pattern
const SCANNED_SOURCE_ID = 'scanned-wijken';
const SCANNED_FILL_LAYER = 'scanned-wijken-fill';
const SCANNED_LINE_LAYER = 'scanned-wijken-line';

export function addScannedWijkHighlight(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  scannedWijkNames: string[]
): void {
  if (map.getSource(SCANNED_SOURCE_ID)) return;

  const scannedSet = new Set(scannedWijkNames);
  const filteredFeatures = wijkGeojson.features.filter(
    (f) => scannedSet.has(f.properties?.statnaam as string)
  );

  map.addSource(SCANNED_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: filteredFeatures },
  });

  const beforeLayer = map.getLayer('wijk-fill') ? 'wijk-fill' : undefined;

  map.addLayer(
    { id: SCANNED_FILL_LAYER, type: 'fill', source: SCANNED_SOURCE_ID,
      paint: { 'fill-color': 'rgba(245, 158, 11, 0.25)', 'fill-antialias': true } },
    beforeLayer
  );
  map.addLayer(
    { id: SCANNED_LINE_LAYER, type: 'line', source: SCANNED_SOURCE_ID,
      paint: { 'line-color': 'rgba(245, 158, 11, 0.7)', 'line-width': 2 } },
    beforeLayer
  );
}
```

### Pattern 2: Score Toggle in LayerToggle (MAP-03)

`LayerToggle.tsx` needs a new optional prop `showScoreToggle?: boolean` and a new callback `onScoreToggle?: (visible: boolean) => void`. The button should only appear when `showScoreToggle` is true (when an active scan is present).

Follow the existing `showWijkenToggle` pattern exactly:

```typescript
// In LayerToggle.tsx
interface LayerToggleProps {
  // ... existing props
  onScoreToggle?: (visible: boolean) => void;
  showScoreToggle?: boolean;
}

// Inside component:
const [showScore, setShowScore] = useState(true); // Default on when scan completes

const handleScoreToggle = () => {
  const newShow = !showScore;
  setShowScore(newShow);
  onScoreToggle?.(newShow);
};

// In JSX (after wijken toggle, same conditional pattern):
{showScoreToggle && (
  <>
    <div className="border-l border-grey-700 h-6 self-center mx-0.5" />
    <button
      onClick={handleScoreToggle}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
        showScore ? overlayActive : overlayInactive
      }`}
    >
      Perceel Score
    </button>
  </>
)}
```

In `map.tsx`, pass `showScoreToggle={!!activeScanId}` and `onScoreToggle` handler that calls `setParcelScoreVisibility(mapRef.current, visible)`.

### Pattern 3: Score Layer Restoration on nav back from scan history (MAP-02)

Currently `map.tsx` line 251-254 adds the score layer only on scan completion. When user navigates from scan history via `?scan_id=X`, `urlScanId` is set, `activeScanId` is set from that, but no score layer is added because there is no polling status event.

The fix is a second `useEffect` that triggers when `activeScanId` is restored from URL and the map is ready, mirroring the existing one:

```typescript
// Restoration: when returning to map with ?scan_id=X, the scan is already completed.
// The existing useEffect only triggers on scanStatus.data.status === 'completed' (active poll).
// This effect handles the restoration path where activeScanId comes from urlScanId.
useEffect(() => {
  if (!mapReady || !mapRef.current || !activeScanId) return;
  // Only restore if NOT currently polling (i.e., coming from URL, not active scan)
  if (scanStatus.data?.status === 'completed' || !scanStatus.data) {
    const tileUrl = getScanTileUrl(activeScanId);
    // addParcelScoreLayer has internal guard: won't re-add if source exists
    addParcelScoreLayer(mapRef.current, tileUrl, 'parcel_scores');
  }
}, [activeScanId, mapReady]);
```

The `addParcelScoreLayer` function already has a guard (`if (map.getSource(SOURCE_ID)) return;`) so calling it twice is safe.

### Pattern 4: Scanned Wijk Data from scan history

The scanned wijk names come from `useScanHistory()` (already implemented in Phase 38). In `map.tsx`, add `useScanHistory({ status: 'completed', limit: 100 })` and extract `wijk_naam` values. When `activeGemeente` is set and `wijkGeojson` loads, also call `addScannedWijkHighlight()` with the matched wijk names.

Scope: only show highlighted wijken for the currently active gemeente (filter scan history by `gemeente_code`).

```typescript
// In map.tsx — extract scanned wijk names for active gemeente
const scannedWijkNames = useMemo(() => {
  if (!activeGemeente || !scanHistory?.scans) return [];
  return scanHistory.scans
    .filter(s => s.gemeente_code === activeGemeente.code && s.status === 'completed' && s.wijk_naam)
    .map(s => s.wijk_naam as string);
}, [activeGemeente, scanHistory?.scans]);
```

### Anti-Patterns to Avoid

- **Don't query `/api/scans` on every wijk GeoJSON load**: Use `useScanHistory` with caching (already has 5min stale time).
- **Don't use GeoJSON for parcel polygons** (Pitfall 10 in PITFALLS.md): 500 parcels at full precision = 3-8MB. The existing MVT tile endpoint is the correct approach. Never add a `/geojson` endpoint for parcels.
- **Don't modify `tile_proxy.py`**: The MVT query already returns `score` and `score_category` as tile properties (verified in source). Plan 39-01 from the roadmap ("Extend tile_proxy.py MVT query") is already done — `tile_proxy.py` already does the JOIN on `scan_results`.
- **Don't add a new tile route**: The tile endpoint already exists at `/api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf`.
- **Don't use GeoJSON source for parcel polygons**: Only the wijk highlight uses GeoJSON (small, static). Parcels always use MVT tiles.
- **Don't reset score layer visibility when adding it**: User should see it enabled by default when a scan loads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport-aware parcel rendering | Custom geojson fetch + filter | Existing MVT tile endpoint | Already implemented; tiles are bounds-filtered by PostGIS ST_Intersects |
| Score-to-color mapping | Custom color scale logic | Existing MapLibre `interpolate` expression in ParcelScoreLayer | Already coded with correct Tailwind colors (red-600 → green-600) |
| Hover/click on parcels | Custom event handling | Existing `mousemove`/`mouseleave` handlers in ParcelScoreLayer | Already implemented with feature-state management |
| Wijk GeoJSON filtering | New backend endpoint | Client-side filter on cached `wijkGeojson` state | GeoJSON is already in memory in `map.tsx` state |
| Scan list for wijk names | New dedicated API | `useScanHistory({ status: 'completed' })` | Already implemented in Phase 38 |

**Key insight:** Most of Phase 39 is wiring together existing pieces, not building new ones.

## Common Pitfalls

### Pitfall 1: tile_proxy.py Already Has Score — Plan 39-01 Is Already Done

**What goes wrong:** Planner creates a task to "extend tile_proxy.py to include score" — but the code already does this. Lines 96-97 in `tile_proxy.py` already JOIN `scan_results` and return `sr.score` and `sr.flags->>'category' AS score_category` in the MVT data.

**Why it happens:** The roadmap says "Extend tile_proxy.py MVT query to include scan-result parcels" but this was implemented in Phase 21 and is confirmed in the current codebase.

**How to avoid:** Verify first. The tile_proxy.py query already does:
```sql
JOIN scan_results sr ON sr.parcel_id = pc.id
...
sr.score,
sr.flags->>'category' AS score_category
```
Plan 39-01 should be marked as trivially done or replaced with Redis tile caching (Pitfall 8 in PITFALLS.md) which is the actual unresolved issue.

**Warning signs:** If a plan says "add score column to MVT query", check tile_proxy.py first.

### Pitfall 2: Score Layer Not Restored on URL-Based Navigation

**What goes wrong:** User navigates to `/map?scan_id=X` from scan history. `activeScanId` is set but the score layer is never added because the existing `useEffect` (line 247-255 of map.tsx) only triggers when `scanStatus.data.status === 'completed'`. Since there is no active polling for a pre-existing scan, the layer never appears.

**Why it happens:** The existing trigger couples score layer addition to active polling completion rather than the presence of `activeScanId` on a completed scan.

**How to avoid:** Add a second `useEffect` that fires on `[activeScanId, mapReady]` and calls `addParcelScoreLayer()`. The `getSource()` guard inside `addParcelScoreLayer` prevents double-adding.

**Warning signs:** Score layer appears when scan completes live but not when returning from scan history.

### Pitfall 3: Scanned Wijk Highlight Timing — Layer Order With WijkBoundariesLayer

**What goes wrong:** `ScannedWijkHighlightLayer` is added before `WijkBoundariesLayer` exists on the map. The `beforeLayer = map.getLayer('wijk-fill') ? 'wijk-fill' : undefined` pattern then falls back to `undefined` (appended on top), covering the CBS wijk borders with the amber fill.

**Why it happens:** `addWijkBoundariesLayer` is called when wijkGeojson loads, and `addScannedWijkHighlight` might be called in the same effect or before wijk layer is ready.

**How to avoid:** Always add `ScannedWijkHighlightLayer` AFTER `addWijkBoundariesLayer` in the same `useEffect` callback, or verify wijk layer exists before adding highlight.

**Warning signs:** Amber fill covers the wijk border lines instead of appearing beneath them.

### Pitfall 4: Scanned Wijk Names vs. CBS statnaam Property

**What goes wrong:** `area_scans.wijk_naam` stores the CBS `statnaam` value (e.g., "Binnenstad"). The `wijkGeojson.features[].properties.statnaam` is the same value. BUT: if the wijk scan was triggered via viewport (not wijk click), `wijk_naam` may be `null` in `area_scans`. These viewport scans cannot be highlighted by name — they don't have a wijk_naam.

**Why it happens:** Viewport scans set `wijk_naam = null` in `ScanCreateRequest`. Only wijk-click scans populate `wijk_naam`.

**How to avoid:** Filter `scanHistory.scans` where `s.wijk_naam !== null` before building the highlighted set. Viewport scans (wijk_naam = null) simply won't be highlighted — this is correct behavior since their geometry doesn't correspond to a single wijk polygon.

**Warning signs:** `undefined` or `null` entries in the scanned wijk name set causing incorrect filter results.

### Pitfall 5: LayerToggle Prop Signature Change Must Not Break Existing Callers

**What goes wrong:** Adding new optional props `showScoreToggle` and `onScoreToggle` to `LayerToggle` and forgetting to update all call sites causes TypeScript errors.

**Why it happens:** `LayerToggle` is called in one place: `map.tsx` line 958. TypeScript will catch any missing required props, but optional props with no defaults can be silent.

**How to avoid:** Make both new props optional with `?`. The toggle button is hidden when `showScoreToggle` is falsy — same as `showWijkenToggle`.

**Warning signs:** `npm run check` type errors in map.tsx.

### Pitfall 6: MVT Tile Authentication — Tile URL Must Include Auth Token

**What goes wrong:** The tile endpoint requires JWT authentication (`get_current_active_user` dep on line 712). MapLibre fetches tile URLs directly from the browser without the app's fetch interceptors. If the tile URL is unauthenticated, tiles return 401 and the score layer shows nothing.

**Why it happens:** MapLibre's `type: 'vector'` source fetches tiles using the browser's native fetch, bypassing any axios/httpx interceptors. JWT is in httpOnly cookies — but the tile endpoint uses Bearer token auth via the `Authorization` header, not cookies.

**How to avoid:** This is a pre-existing design. Check how `getScanTileUrl` works — it currently returns a bare URL without auth headers. Verify that the tile endpoint actually works in production. If tiles are behind cookie-based auth (httpOnly cookie), MapLibre will send the cookie automatically. If Bearer token is required in the header, tiles will fail.

**Investigation needed:** Confirm whether `get_current_active_user` in `get_scan_tiles` uses cookie or Bearer auth. Look at `auth/dependencies.py`. This may already work (cookie) or may be a known issue.

**Warning signs:** Network tab shows 401 responses for `.pbf` tile requests.

## Code Examples

### ScannedWijkHighlightLayer.tsx (new file)

```typescript
// Pattern: MonitoredWijkOverlay.tsx (already in codebase)
import type maplibregl from 'maplibre-gl';

const SCANNED_SOURCE_ID = 'scanned-wijken';
const SCANNED_FILL_LAYER = 'scanned-wijken-fill';
const SCANNED_LINE_LAYER = 'scanned-wijken-line';

export function addScannedWijkHighlight(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  scannedWijkNames: string[]
): void {
  if (map.getSource(SCANNED_SOURCE_ID)) return;

  const scannedSet = new Set(scannedWijkNames.filter(Boolean));
  const filtered = wijkGeojson.features.filter(
    (f) => scannedSet.has(f.properties?.statnaam as string)
  );

  if (filtered.length === 0) return; // Nothing to highlight

  map.addSource(SCANNED_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: filtered },
  });

  const beforeLayer = map.getLayer('wijk-fill') ? 'wijk-fill' : undefined;

  map.addLayer(
    { id: SCANNED_FILL_LAYER, type: 'fill', source: SCANNED_SOURCE_ID,
      paint: { 'fill-color': 'rgba(245, 158, 11, 0.25)', 'fill-antialias': true } },
    beforeLayer
  );
  map.addLayer(
    { id: SCANNED_LINE_LAYER, type: 'line', source: SCANNED_SOURCE_ID,
      paint: { 'line-color': 'rgba(245, 158, 11, 0.7)', 'line-width': 2 } },
    beforeLayer
  );
}

export function removeScannedWijkHighlight(map: maplibregl.Map): void {
  if (map.getLayer(SCANNED_LINE_LAYER)) map.removeLayer(SCANNED_LINE_LAYER);
  if (map.getLayer(SCANNED_FILL_LAYER)) map.removeLayer(SCANNED_FILL_LAYER);
  if (map.getSource(SCANNED_SOURCE_ID)) map.removeSource(SCANNED_SOURCE_ID);
}

export function updateScannedWijkHighlight(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  scannedWijkNames: string[]
): void {
  removeScannedWijkHighlight(map);
  addScannedWijkHighlight(map, wijkGeojson, scannedWijkNames);
}
```

### Score Layer Restoration in map.tsx

```typescript
// Existing effect (line 247-255) triggers on scan completion from active polling
// NEW: second effect for URL-based restoration
useEffect(() => {
  if (!mapReady || !mapRef.current || !activeScanId) return;
  // addParcelScoreLayer has internal guard -- safe to call multiple times
  const tileUrl = getScanTileUrl(activeScanId);
  addParcelScoreLayer(mapRef.current, tileUrl, 'parcel_scores');
}, [activeScanId, mapReady]);
// Note: existing effect on scanStatus.data still handles live scan completion
```

### Scanned Wijk Effect in map.tsx

```typescript
// Derive scanned wijk names for active gemeente from scan history
const { data: scanHistory } = useScanHistory({ limit: 100 });

const scannedWijkNames = useMemo(() => {
  if (!activeGemeente || !scanHistory?.scans) return [];
  return scanHistory.scans
    .filter(s =>
      s.gemeente_code === activeGemeente.code &&
      s.status === 'completed' &&
      s.wijk_naam !== null
    )
    .map(s => s.wijk_naam as string);
}, [activeGemeente, scanHistory?.scans]);

// Effect: add/update scanned wijk highlight when wijkGeojson loads
useEffect(() => {
  if (!mapReady || !mapRef.current || !wijkGeojson || scannedWijkNames.length === 0) return;
  addScannedWijkHighlight(mapRef.current, wijkGeojson, scannedWijkNames);
  return () => {
    if (mapRef.current) removeScannedWijkHighlight(mapRef.current);
  };
}, [mapReady, wijkGeojson, scannedWijkNames]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Martin tile server for MVT | PostGIS ST_AsMVT in tile_proxy.py | Phase 21 | Multi-tenant tile isolation built-in |
| GeoJSON for parcel polygons | MVT vector tiles | Phase 21 | Viewport-aware, 2000+ parcels performant |
| No wijk highlight | MonitoredWijkOverlay pattern | Phase 26 | Establishes the GeoJSON filter pattern for MAP-01 |
| Score layer added on completion only | Score layer also restored on URL nav | Phase 39 (new) | Scan history nav works |

**Already done (roadmap said TBD):**
- Plan 39-01 "Extend tile_proxy.py MVT query to include scan-result parcels with opportunity score": The `tile_proxy.py` already does this. The JOIN and score columns are present in the current code. This plan is effectively a no-op for the tile query itself; it may need to pivot to Redis tile caching (per Pitfall 8 in PITFALLS.md) for production readiness.

## Open Questions

1. **Tile Authentication: Cookie vs. Bearer Token**
   - What we know: `get_scan_tiles` uses `get_current_active_user` dep. MapLibre fetches tiles natively.
   - What's unclear: Does the auth middleware accept httpOnly cookies (which MapLibre would send automatically) or does it require a Bearer token in the Authorization header (which MapLibre can't add)?
   - Recommendation: Check `backend/app/auth/dependencies.py` — look for `get_current_active_user` implementation. If it reads from cookie, tiles work. If Bearer only, tiles need a token-signed URL or a cookie-based approach. This is the highest-risk item for MAP-02.
   - Confidence: Need to verify. If tiles already work in dev (they appear to, since the existing scan completion effect adds the layer), then cookies are being sent.

2. **Plan 39-01 Scope**
   - What we know: tile_proxy.py already has score data in the MVT output.
   - What's unclear: What should Plan 39-01 actually contain? Options: (a) mark as trivially verified + document, (b) repurpose to add Redis tile caching (Pitfall 8), or (c) add additional tile properties (parcel_code, gemeente_code) for richer click handling.
   - Recommendation: Verify the tile query output matches what the frontend needs, then either close as done or add Redis caching if the codebase has available Redis access from tile_proxy.
   - Confidence: HIGH that current tile query is correct. MEDIUM on whether Redis caching is appropriate for Phase 39 scope vs. Phase 41 hardening.

3. **Scanned Wijk Highlight When No Gemeente Selected**
   - What we know: MAP-01 says "scanned wijken appear with a distinct highlight." The wijk GeoJSON only loads after a gemeente is selected.
   - What's unclear: Should scanned wijken be highlighted before a gemeente is selected? The wijkGeojson is only loaded on-demand per-gemeente.
   - Recommendation: Only highlight within the active gemeente context (when wijkGeojson is loaded). This is consistent with the existing MonitoredWijkOverlay pattern. Accept that before gemeente selection, no wijk highlights are visible — which is correct UX since there are no wijk boundaries drawn yet anyway.

## Sources

### Primary (HIGH confidence — verified by reading actual code)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/services/tile_proxy.py` — MVT query with score JOIN (lines 76-107)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/scans/router.py` — Tile endpoint at lines 705-756
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/map/ParcelScoreLayer.tsx` — Full score layer implementation
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/map/WijkBoundariesLayer.tsx` — CBS wijk layer (statnaam property confirmed)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/map/MonitoredWijkOverlay.tsx` — GeoJSON filter overlay pattern
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/map/LayerToggle.tsx` — Existing toggle pattern for wijken (showWijkenToggle)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/routes/_authenticated/map.tsx` — Full map page with existing score layer trigger (lines 247-255)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/hooks/useScans.ts` — useScanHistory hook available
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/models/area_scan.py` — wijk_naam field nullable
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/research/PITFALLS.md` — Pitfall 8 (MVT tile caching), Pitfall 10 (GeoJSON size)

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` — Phase 39 plan descriptions (used to validate scope)
- `.planning/REQUIREMENTS.md` — MAP-01, MAP-02, MAP-03 requirement text

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all libraries verified in package.json and imports
- Architecture: HIGH — all patterns verified against existing code (MonitoredWijkOverlay, LayerToggle, existing score layer trigger)
- Pitfalls: HIGH — pitfalls verified against actual code (tile_proxy.py already done, score restoration gap identified from code reading)
- Open questions: MEDIUM — tile auth needs one file check to confirm

**Research date:** 2026-02-19
**Valid until:** 2026-03-20 (stable tech, 30-day window)
