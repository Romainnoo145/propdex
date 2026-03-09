# Phase 93: Parcel Detail Panel - Research

**Researched:** 2026-03-10
**Domain:** Frontend panel component + backend aerial crop API
**Confidence:** HIGH

## Summary

Phase 93 replaces the current scrollable `ParcelDetailModal` with a floating glass panel using the Aura design system. The panel uses a bento pod pattern (2x2 grid of clickable category pods) with click-through navigation to detail layers. A new backend endpoint proxies PDOK aerial imagery for the hero image.

The existing codebase already has all the primitives needed: `GlassPanel`, `BentoPod`, `PillBadge` components from Phase 91, CSS animations (`fly-in-right`, `slide-up`), and z-index scale. The current `ParcelDetailModal` (776 lines) already contains all the data rendering logic (score, bestemmingen, risk profile, market signals, vergunningen, meldingen) that needs to be reorganized into 4 category pods with click-through layers.

**Primary recommendation:** Decompose `ParcelDetailModal` into a new `ParcelDetailPanel` component tree with shared data hooks, keeping existing data fetching patterns intact. Build the backend aerial crop endpoint as a thin WMS proxy to PDOK.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fixed right-side panel, ~380px wide, positioned top-4 right-4 bottom-4
- Glass blur background, matches Aura design system (like SideRailNav on the left)
- Slide + fade animation from right when opening
- Clicking another parcel cross-fades content within the panel
- Close via X button or clicking the map background
- Map re-center on open: shift center to account for panel width (re-center only, do NOT auto-zoom)
- Live satellite crop from backend API, centered on parcel coordinates, full-width ~160px tall
- Score badge: bottom-right pill badge overlaid on hero image with amber-to-green gradient
- Address bar between hero and bento grid, persists in detail layers
- 4 category pods in 2x2 grid: Potentie, Risico, Markt, Juridisch
- Each pod shows score/icon + one-word label (minimal, scannable)
- No separate bestemming status bar -- bestemming is part of Juridisch pod
- Zero-scroll on bento overview
- Click-through layers replace content below hero+address
- Back arrow returns to bento overview (no horizontal swipe)
- Detail layers CAN scroll within the panel
- Sticky bottom bar with "Genereer Rapport" / "Bekijk Rapport" button
- "Bekijk Rapport" gets green accent (aura-green) instead of amber

### Claude's Discretion
- Exact pod dimensions and spacing within 2x2 grid
- Loading skeleton design while satellite image loads
- Error states (no satellite image, no data for category)
- Detail layer sub-section layout (stacked vs sub-cards per category)
- Property info fields (oppervlak, bouwjaar, gemeente) placement -- fold into relevant category detail layers
- Whether sub-sections within a category show all at once or as clickable sub-cards (based on data density)

### Deferred Ideas (OUT OF SCOPE)
- Parcel comparison ("Vergelijken")
- Share/link to specific parcel
- Horizontal swipe between categories
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRC-01 | Floating right detail panel (glass) with satellite crop hero image, score badge overlay, address header | GlassPanel primitive exists, PDOK WMS aerial crop endpoint pattern documented, score badge uses PillBadge |
| PRC-02 | Primary stats bento grid (4 pods): oppervlakte, bouwjaar, status, gemeente -- icon + value, no scroll | CONTEXT.md overrides this: 4 category pods (Potentie, Risico, Markt, Juridisch) not property fields. BentoPod primitive exists |
| PRC-03 | Bestemming as wide horizontal status bar with soft color fill | CONTEXT.md overrides: bestemming is part of Juridisch pod, no separate status bar |
| PRC-04 | Kansen & aandachtspunten as horizontal pill/tag cloud | Existing pill rendering in ParcelDetailModal, PillBadge primitive available. Place in Markt detail layer |
| PRC-05 | Click-through layers for deeper data: clicking a bento pod opens detail layer replacing current view | React state machine pattern documented below; existing data hooks support all 17+ sections |
| PRC-06 | Vergunningen as accordion-style bento pod (shows count, expands on click) | Part of Juridisch detail layer; ParcelEnrichmentCard already handles vergunningen data |
| PRC-07 | "Genereer Rapport" pinned at bottom of panel | Existing useGenerateReportFromParcel hook; sticky bottom bar pattern documented |
| API-01 | Backend endpoint for cropped PDOK aerial image | PDOK WMS GetMap endpoint documented; backend proxy pattern matches existing architecture |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | Component framework | Already in project |
| TanStack Query | 5.x | Data fetching/caching | Already used for all API calls |
| class-variance-authority | 0.7.x | Component variants | Used in all Aura primitives |
| Lucide React | latest | Icons | Already used throughout |
| FastAPI | 0.115.x | Backend API | Existing backend framework |
| httpx | 0.28.x | HTTP client for PDOK proxy | Already used via app.state.http_client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GlassPanel | (project) | Glass blur panel container | Panel shell |
| BentoPod | (project) | Translucent pod container | Category pods |
| PillBadge | (project) | Score/status badges | Score badge, bestemming labels |

### Alternatives Considered
None -- all libraries are already in the project.

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/components/map/panels/
  ParcelDetailPanel.tsx        # Main panel (replaces ParcelDetailModal in map context)
  parcel/
    ParcelPanelShell.tsx       # Glass panel shell with slide animation + sticky footer
    ParcelHero.tsx             # Satellite crop image + score badge overlay
    ParcelBentoOverview.tsx    # 2x2 grid of category pods
    PotentiePod.tsx            # Score + vrije ruimte + transformatie summary
    RisicoPod.tsx              # Traffic light icon + risk summary
    MarktPod.tsx               # Days-on-market + kansen summary
    JuridischPod.tsx           # Bestemming type label summary
    layers/
      PotentieLayer.tsx        # Full score breakdown, vrije ruimte, transformatie detail
      RisicoLayer.tsx          # FysiekRisicoprofielSection content
      MarktLayer.tsx           # Market signals + kansen & aandachtspunten pills
      JuridischLayer.tsx       # Bestemmingen cards + vergunningen accordion + meldingen
```

### Backend
```
backend/app/scans/
  router.py                    # Add GET /parcels/{parcel_id}/aerial-crop endpoint
```

### Pattern 1: Panel Navigation State Machine
**What:** Use a discriminated union for panel view state (overview vs detail layer)
**When to use:** Panel has overview + 4 click-through layers
**Example:**
```typescript
type PanelView =
  | { kind: 'overview' }
  | { kind: 'potentie' }
  | { kind: 'risico' }
  | { kind: 'markt' }
  | { kind: 'juridisch' }

const [view, setView] = useState<PanelView>({ kind: 'overview' })
```

### Pattern 2: Map Re-center on Panel Open
**What:** When panel opens, shift map center to account for panel width so parcel stays centered in visible area
**When to use:** Every time a parcel is selected
**Example:**
```typescript
// Panel is ~380px wide + 16px right margin = ~396px
// Shift map center leftward by half the panel width in screen pixels
const panelOffsetPx = 380 / 2
const point = map.project(parcelCenter)
point.x -= panelOffsetPx
const adjustedCenter = map.unproject(point)
map.easeTo({ center: adjustedCenter, duration: 500 })
```

### Pattern 3: Backend Aerial Crop Proxy
**What:** Proxy PDOK WMS GetMap request to return a cropped aerial image centered on parcel coordinates
**When to use:** Hero image in panel
**Example:**
```python
# PDOK WMS endpoint for aerial imagery
PDOK_LUCHTFOTO_WMS = "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0"

@router.get("/parcels/{parcel_id}/aerial-crop")
async def get_aerial_crop(
    request: Request,
    parcel_id: uuid.UUID,
    width: int = 380,
    height: int = 160,
    ...
):
    # 1. Get parcel centroid in RD (EPSG:28992)
    # 2. Build bbox around centroid (~150m radius for context)
    # 3. Fetch WMS GetMap from PDOK
    # 4. Return JPEG with cache headers
```

### Pattern 4: Content Cross-fade
**What:** When clicking a different parcel while panel is open, cross-fade content
**When to use:** Panel already showing, user clicks another parcel
**Example:**
```typescript
// Use a key on the content wrapper to trigger React re-mount with animation
<div key={parcel.parcel_id} className="animate-fade-in">
  {/* panel content */}
</div>
```

### Anti-Patterns to Avoid
- **Scrolling the bento overview:** Overview MUST fit without scrolling. If content doesn't fit, reduce pod padding, never add scroll
- **Blur on every surface:** Only the panel shell gets backdrop-blur. Inner pods use solid bg-white/40
- **Separate components for modal vs panel:** Don't duplicate logic. Keep `ParcelDetailModal` for `/resultaten` route, extract shared data display components
- **Fetching aerial image without caching:** Always set Cache-Control headers on aerial crop response (images rarely change)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aerial image crop | Custom tile stitching | PDOK WMS GetMap (single request, returns cropped JPEG) | WMS handles CRS conversion, rendering, label-free output |
| Panel animation | Custom CSS animation | Existing `animate-fly-in-right` class in index.css | Already tuned for Aura timing (300ms cubic-bezier) |
| Glass blur styling | Custom backdrop-filter | `GlassPanel blur="active"` primitive | Handles fallback, border, shadow consistently |
| Category pod styling | Custom div + tailwind | `BentoPod interactive={true}` primitive | Handles hover scale, glow, spacing |
| Score badge | Custom positioned span | `PillBadge` with absolute positioning | Consistent radius, font, spacing |
| Report generation | New mutation hook | Existing `useGenerateReportFromParcel` from hooks/useReports | Already handles toast, navigation, cache invalidation |

**Key insight:** 90% of the visual primitives and data hooks already exist. This phase is primarily a reorganization of existing content into a new layout pattern.

## Common Pitfalls

### Pitfall 1: Panel Width Pushes Content Off-Screen
**What goes wrong:** 380px panel on smaller desktop screens (1280px) leaves insufficient map space
**Why it happens:** Fixed width doesn't account for SideRailNav (80px) on the left
**How to avoid:** Panel positioning already accounts for this (right-4). Remaining map area is 1280 - 380 - 80 - 32 = 788px which is fine. No issue at 1280+
**Warning signs:** Panel overlapping SideRailNav

### Pitfall 2: Aerial Image Loading Delay
**What goes wrong:** Hero image takes 500ms+ to load from PDOK, causing layout shift
**Why it happens:** WMS GetMap is a server-side render operation
**How to avoid:** Fixed height container (h-40 / 160px) with skeleton loading state. Backend should set `Cache-Control: public, max-age=86400` since aerial photos change yearly
**Warning signs:** Content jumping when image loads

### Pitfall 3: Data Dependencies Between Pods and Layers
**What goes wrong:** Each pod needs a summary metric, but the full data comes from different hooks
**Why it happens:** Risk data comes from `useParcelRiskProfile`, enrichment from `useParcelEnrichment`, base data from the parcel ScanResultItem
**How to avoid:** Fetch all data at panel level and pass down. Don't lazy-load data per pod -- pods show summaries from already-available data. Only enrichment (vergunningen) and risk profile are async
**Warning signs:** Pods showing loading states individually

### Pitfall 4: Z-Index Collision with Other Map Panels
**What goes wrong:** Panel overlaps or underlaps other floating elements
**Why it happens:** GemeenteMapPanel and WijkMapPanel use `calc(var(--z-map-controls) + 2)`. The new panel needs the same or higher
**How to avoid:** Use `--z-property-panel` (300) which is already defined for this purpose. Only one panel shows at a time (ActivePanel union type ensures this)
**Warning signs:** Panel appearing behind search bar or layer toggle

### Pitfall 5: Cross-fade Breaking Data Hooks
**What goes wrong:** When switching parcels, React Query hooks fire for new parcel before old data clears
**Why it happens:** Key change unmounts/remounts but hooks persist at parent level
**How to avoid:** Manage hooks in the parent (map.tsx) where they already live, pass data down as props. Don't put hooks inside the keyed container
**Warning signs:** Stale data flash before new data loads

## Code Examples

### Aerial Crop Backend Endpoint
```python
# In backend/app/scans/router.py
from fastapi.responses import Response

PDOK_LUCHTFOTO_WMS = "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0"
AERIAL_CROP_RADIUS_M = 75  # 150m total bbox width

@router.get("/parcels/{parcel_id}/aerial-crop")
@limiter.limit("60/minute")
async def get_aerial_crop(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return cropped aerial image centered on parcel."""
    # 1. Get centroid in RD (EPSG:28992) from PostGIS
    from geoalchemy2.functions import ST_AsText, ST_Centroid
    query = select(
        ST_AsText(ST_Centroid(ParcelCache.geometry)),
    ).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await db.execute(query)
    wkt = result.scalar_one_or_none()
    if not wkt:
        raise HTTPException(404, "Parcel not found")

    import re
    m = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", wkt)
    x, y = float(m.group(1)), float(m.group(2))

    # 2. Build bbox (150m x ~63m to match 380x160 aspect ratio)
    half_w = AERIAL_CROP_RADIUS_M
    half_h = half_w * (160 / 380)
    bbox = f"{x - half_w},{y - half_h},{x + half_w},{y + half_h}"

    # 3. Fetch from PDOK WMS
    client: httpx.AsyncClient = request.app.state.http_client
    wms_url = (
        f"{PDOK_LUCHTFOTO_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
        f"&LAYERS=Actueel_orthoHR&STYLES=&CRS=EPSG:28992"
        f"&BBOX={bbox}&WIDTH=760&HEIGHT=320&FORMAT=image/jpeg"
    )
    resp = await client.get(wms_url, timeout=10.0)
    if resp.status_code != 200:
        raise HTTPException(502, "PDOK aerial service unavailable")

    return Response(
        content=resp.content,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
```

### Panel Shell with Slide Animation
```typescript
// ParcelPanelShell.tsx
export function ParcelPanelShell({
  children,
  onClose,
  footer,
}: {
  children: React.ReactNode
  onClose: () => void
  footer: React.ReactNode
}) {
  return (
    <div
      className="fixed top-4 right-4 bottom-4 w-[380px] animate-fly-in-right aura-float"
      style={{ zIndex: 'var(--z-property-panel)' }}
    >
      <GlassPanel blur="active" className="h-full flex flex-col overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {/* Sticky footer */}
        <div className="shrink-0 border-t border-white/40 bg-aura-glass-white/60 backdrop-blur-sm p-3">
          {footer}
        </div>
      </GlassPanel>
    </div>
  )
}
```

### Bento Overview Grid
```typescript
// ParcelBentoOverview.tsx
export function ParcelBentoOverview({
  parcel,
  riskProfile,
  onSelectCategory,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      <BentoPod interactive onClick={() => onSelectCategory('potentie')}>
        <p className="text-kpi tabular-nums text-aura-amber">
          {parcel.score != null ? Math.round(parcel.score) : '--'}
        </p>
        <p className="text-label text-neutral-500">Potentie</p>
      </BentoPod>
      <BentoPod interactive onClick={() => onSelectCategory('risico')}>
        {/* Traffic light icon */}
        <p className="text-label text-neutral-500">Risico</p>
      </BentoPod>
      <BentoPod interactive onClick={() => onSelectCategory('markt')}>
        <p className="text-kpi tabular-nums">
          {parcel.market_signals?.listing_duration_days ?? '--'}
        </p>
        <p className="text-label text-neutral-500">Markt</p>
      </BentoPod>
      <BentoPod interactive onClick={() => onSelectCategory('juridisch')}>
        <p className="text-sm font-medium text-aura-ink truncate">
          {primaryBestemming?.type ?? 'Onbekend'}
        </p>
        <p className="text-label text-neutral-500">Juridisch</p>
      </BentoPod>
    </div>
  )
}
```

### Frontend API Call for Aerial Image
```typescript
// In api.ts
export function getAerialCropUrl(parcelId: string, accessToken: string | null): string {
  const base = `${SCANS_BASE}/parcels/${parcelId}/aerial-crop`
  // Return URL for <img src> -- add token as query param or use fetch
  return base
}

// In component -- use query hook for auth
export function useAerialCrop(parcelId: string | null) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: ['aerial-crop', parcelId],
    queryFn: async () => {
      const resp = await fetch(
        `${API_BASE}/api/scans/parcels/${parcelId}/aerial-crop`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!resp.ok) return null
      const blob = await resp.blob()
      return URL.createObjectURL(blob)
    },
    enabled: !!parcelId && !!accessToken,
    staleTime: 24 * 60 * 60 * 1000, // 24h -- aerial images don't change
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scrollable modal with all sections | Bento overview + click-through layers | Phase 93 (now) | Zero-scroll overview, progressive disclosure |
| MapPanelShell (generic) | ParcelPanelShell (panel-specific with animation) | Phase 93 (now) | Better UX with slide-in and sticky footer |
| No hero image | PDOK aerial crop as hero | Phase 93 (now) | Immediate spatial context |

**Deprecated/outdated:**
- `ParcelDetailModal` with `presentation="map-panel"`: Will be replaced by `ParcelDetailPanel` for map context. Keep `ParcelDetailModal` for `/resultaten` route (modal presentation)
- `MapPanelShell` for parcel: Currently used by parcel detail via `presentation="map-panel"`. New `ParcelPanelShell` replaces it for parcel use case only

## Open Questions

1. **PDOK WMS rate limits**
   - What we know: PDOK services are free and public, no API key required
   - What's unclear: Whether heavy usage triggers rate limiting
   - Recommendation: Backend caching with 24h TTL handles this. If PDOK throttles, return graceful fallback (gradient placeholder)

2. **Aerial image for parcels without buildings**
   - What we know: Empty parcels show fields/grass in aerial view
   - What's unclear: Whether this is useful or confusing for users
   - Recommendation: Always show aerial -- even empty land gives spatial context. Consider a subtle overlay label "Leeg perceel" when has_pand is false

3. **Score badge gradient (amber-to-green)**
   - What we know: User wants amber-to-green gradient matching score value
   - What's unclear: Exact color stops and breakpoints
   - Recommendation: Use existing score thresholds (>=70 green, >=50 amber-green mix, >=30 amber, <30 muted). Can use CSS gradient or stepped colors

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `ParcelDetailModal.tsx`, `MapPanelShell.tsx`, `GlassPanel.tsx`, `BentoPod.tsx`, `PillBadge.tsx`
- PDOK WMS GetCapabilities: `https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?SERVICE=WMS&REQUEST=GetCapabilities`
- PDOK WMTS GetCapabilities: `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?service=WMTS&request=GetCapabilities`

### Secondary (MEDIUM confidence)
- [PDOK Webservices Workshop](https://pdok.github.io/webservices-workshop/) -- WMS parameter documentation
- [Aerial Imagery 8cm and 25cm RGB WMTS](https://data.europa.eu/data/datasets/c82a783a-9a58-4761-a809-b4c5d90dcd35?locale=en) -- Layer naming and availability

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - follows established panel patterns (GemeenteMapPanel, WijkMapPanel), existing primitives
- Pitfalls: HIGH - based on direct codebase analysis of z-index, data hooks, layout constraints
- Backend aerial crop: MEDIUM - PDOK WMS is well-documented but endpoint parameters verified via GetCapabilities only

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external library changes expected)
