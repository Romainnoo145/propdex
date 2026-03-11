# Phase 105: BRK Eigendom Modal - Research

**Researched:** 2026-03-12
**Domain:** Kadaster BRK Bevragen V2 ownership + Aura modal UI
**Confidence:** HIGH

## Summary

Phase 105 adds an on-demand BRK ownership modal triggered from the parcel detail panel. The backend infrastructure is **already built**: `BRKBevragenClient` (mTLS), `fetch_brk_ownership()`, `BRKOwnership`/`PerceelOwnership`/`ZakelijkGerechtigde` schemas, rate limiter, and comprehensive tests (unit + integration) all exist. The core gap is: (1) a dedicated API endpoint that accepts a `parcel_id` (ParcelCache UUID), resolves the PDOK cadastral `identificatie`, calls BRK, and returns ownership data; and (2) a frontend modal component with the adaptive leeg/in-gebruik framing.

A critical data-flow detail: `ParcelCache.parcel_id` stores the human-readable kadastrale aanduiding (e.g., "Venlo A 1234"), NOT the `NL.IMKAD.KadastraalObject.XXXXXXXX` identifier needed by BRK Bevragen V2. The new endpoint must first resolve the BRK identifier by calling PDOK Cadastral API with the parcel centroid, extracting the `identificatie` from the matching feature, then passing it to `fetch_brk_ownership()`.

**Primary recommendation:** Create a thin backend endpoint `/api/scans/parcels/{parcel_id}/eigendom` that chains PDOK lookup -> BRK fetch, and a frontend `EigendomModal` component with confirmation dialog, loading states, and adaptive content framing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The existing "Leeg perceel" / "Pand in gebruik" status indicator in ParcelBentoOverview.tsx (line 236) becomes clickable
- No new buttons -- enhance the existing status element
- Click opens the eigendom/acquisition modal on top of the parcel detail panel
- One modal for both parcel states, with content adapting based on leeg/in-gebruik
- Leeg perceel framing: "grondpositie" -- who owns this land? Gemeente grondzaken path highlighted
- Pand in gebruik framing: "herontwikkeling" -- who owns this building? Eigenaar type routing
- Same BRK data section in both, different contextual framing above it
- Show everything the Kadaster API returns -- all available fields
- Build first with real data, iterate on layout after seeing actual API responses
- Multiple zakelijk gerechtigden: Claude decides layout based on Aura aesthetic
- Based on eigenaar type, show contextual tips (gemeente grond, woningcorporatie, particulier, institutioneel)
- "Eigendom opvragen" button shows a warning popup BEFORE making the Kadaster API call
- Warning text: "Kost 1 credit. Data wordt niet opgeslagen en is eenmalig zichtbaar."
- User must confirm before the API call fires
- BRK data is purely ephemeral -- fetch, display, discard on modal close
- No database storage, no caching of Kadaster ownership data
- Modal shows teaser sections (locked/blurred) for data in the full rapport
- Prominent "Genereer Rapport" CTA to drive conversion
- The eigendom lookup itself is the free hook; the full dossier is behind the rapport paywall

### Claude's Discretion
- All UI layout and styling decisions (Aura aesthetic)
- Modal animation and transitions
- Exact placement and design of locked/blurred teaser sections
- Component architecture (shared BRK component vs inline)
- Loading states, error handling, empty states
- Gemeente grondzaken auto-lookup implementation approach

### Deferred Ideas (OUT OF SCOPE)
- Full dossier/deal-sheet compilation -- belongs in rapport v2 (Phase 104)
- Checklist-style acquisition workflow -- future phase
- Caching BRK data for repeat lookups -- blocked by Kadaster license terms
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| httpx | existing | BRK mTLS client + PDOK calls | Already used |
| pydantic | existing | BRKOwnership/PerceelOwnership/ZakelijkGerechtigde schemas | Already built |
| aiolimiter | existing | BRK rate limiter (2 concurrent, 200/hour) | Already configured |
| framer-motion | existing | Modal animations, AnimatePresence | Already used in parcel panel |
| lucide-react | existing | Icons | Already used |
| @tanstack/react-query | existing | On-demand fetch with no caching | Already used |

### No New Dependencies Required
This phase uses exclusively existing dependencies. No new packages needed.

## Architecture Patterns

### Backend: New Endpoint

```
backend/app/scans/router.py  (add endpoint)
  GET /api/scans/parcels/{parcel_id}/eigendom

  Flow:
  1. Validate parcel_id UUID, look up ParcelCache (org-scoped)
  2. Extract centroid from geometry (ST_Centroid → ST_X/ST_Y in EPSG:28992)
  3. Call PDOKCadastralClient.get_parcels_by_point(x, y) to get feature with `identificatie`
  4. Build CadastralParcel with the PDOK `identificatie`
  5. Call existing fetch_brk_ownership([parcel])
  6. Return BRKOwnership JSON (never stored, never cached)
```

**Why this flow:** `ParcelCache.parcel_id` stores human-readable kadastrale aanduiding (e.g., "Venlo A 1234"), but BRK Bevragen V2 requires `NL.IMKAD.KadastraalObject.XXXXXXXX`. The PDOK Cadastral OGC API (free, no auth) returns features whose `properties.identificatie` contains this identifier. The PDOK point lookup resolves the mapping.

### Frontend: Component Structure

```
frontend/src/components/map/panels/parcel/
  ParcelBentoOverview.tsx     # Modify SecondaryField to be clickable
  EigendomModal.tsx           # NEW: Full modal component
  EigendomConfirmDialog.tsx   # NEW: Pre-fetch confirmation popup
```

### Pattern: On-demand Ephemeral Fetch

The frontend must NOT cache BRK data. Use React Query with:
```typescript
// No automatic refetch, no caching, manual trigger only
const eigendomQuery = useQuery({
  queryKey: ['brk-eigendom', parcelId],
  queryFn: () => fetchEigendom(parcelId),
  enabled: false,        // Manual trigger via refetch()
  staleTime: 0,          // Always stale
  gcTime: 0,             // Garbage collect immediately on unmount
})
```

This ensures BRK data lives only in component state while the modal is open. On modal close, React Query garbage collects the data. On reopen, user must confirm and fetch again.

### Pattern: Adaptive Content Framing

```typescript
interface EigendomModalProps {
  parcel: ScanResultItem
  onClose: () => void
}

// Content adapts based on parcel.has_pand
// Both show same BRK data section, different context above
const framing = parcel.has_pand
  ? { title: 'Herontwikkeling', subtitle: 'Wie is eigenaar van dit gebouw?' }
  : { title: 'Grondpositie', subtitle: 'Wie is eigenaar van dit perceel?' }
```

### Pattern: Eigenaar Type Routing Tips

```typescript
const EIGENAAR_TIPS: Record<string, { label: string; tip: string; icon: string }> = {
  natuurlijk_persoon: {
    label: 'Particulier',
    tip: 'Directe benadering of via makelaar',
    icon: 'User',
  },
  rechtspersoon: {
    label: 'Rechtspersoon',
    tip: 'Portfolio-niveau contact of asset manager',
    icon: 'Building',
  },
  overheid: {
    label: 'Overheid / Gemeente',
    tip: 'Grondzaken afdeling benaderen',
    icon: 'Landmark',
  },
  onbekend: {
    label: 'Onbekend',
    tip: 'Type eigenaar niet beschikbaar',
    icon: 'HelpCircle',
  },
}
```

### Anti-Patterns to Avoid
- **Never store BRK data in React Query cache beyond modal lifetime**: Use `gcTime: 0` to ensure immediate cleanup
- **Never persist BRK data to localStorage or sessionStorage**: Kadaster Tier 3 violation
- **Never log BRK response payloads on backend**: Only log request metadata (perceel_id, status code)
- **Never add BRK fields to ParcelCache model**: Model explicitly documents Tier 3 exclusion

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BRK API client | New HTTP client | Existing `BRKBevragenClient` | Already handles mTLS, rate limiting, error states |
| BRK response parsing | Custom parser | Existing `_parse_perceel_ownership()` | Already maps BRK V2 response to PerceelOwnership |
| Ownership schemas | New types | Existing `BRKOwnership`, `PerceelOwnership`, `ZakelijkGerechtigde` | Well-tested, three-state status pattern |
| PDOK cadastral lookup | Custom geometry query | Existing `PDOKCadastralClient.get_parcels_by_point()` | Already handles pagination, RD coordinates |
| Modal backdrop/overlay | Custom overlay div | Framer Motion `AnimatePresence` + existing glass patterns | Consistent with parcel panel animations |

**Key insight:** ~80% of backend work is already done. The BRK client, schemas, parser, rate limiter, and tests are production-ready. The only new backend code is the thin endpoint that chains PDOK lookup -> BRK fetch.

## Common Pitfalls

### Pitfall 1: parcel_code vs. BRK identificatie
**What goes wrong:** Trying to pass `ParcelCache.parcel_id` (human-readable "Venlo A 1234") directly to BRK Bevragen API
**Why it happens:** Confusing `parcel_id` column (kadastrale aanduiding string) with `NL.IMKAD.KadastraalObject.XXXXXXXX` identifier
**How to avoid:** Always resolve via PDOK Cadastral API point lookup first. The PDOK feature `properties.identificatie` contains the BRK-compatible identifier
**Warning signs:** BRK API returns 404 or invalid identifier errors

### Pitfall 2: Caching BRK Data Accidentally
**What goes wrong:** React Query caches the BRK response, or browser stores it in memory across modal opens
**Why it happens:** Default React Query gcTime is 5 minutes
**How to avoid:** Set `gcTime: 0` and `staleTime: 0` on the eigendom query. Use `enabled: false` with manual `refetch()` trigger
**Warning signs:** BRK data persists after modal close without re-confirmation

### Pitfall 3: PDOK Centroid Coordinate System
**What goes wrong:** Passing WGS84 coordinates to PDOK Cadastral API which expects EPSG:28992
**Why it happens:** Frontend uses WGS84 (lat/lng), ParcelCache geometry is stored in EPSG:28992
**How to avoid:** Extract centroid server-side using PostGIS `ST_Centroid(geometry)` which is already in EPSG:28992. Pass RD coordinates directly to PDOK
**Warning signs:** PDOK returns 0 features or wrong parcels

### Pitfall 4: Multiple Features from PDOK Point Lookup
**What goes wrong:** PDOK point query returns multiple overlapping parcels
**Why it happens:** Small bbox around centroid may intersect neighboring parcels
**How to avoid:** Use `distance=1.0` (1m bbox) and pick the first feature. Or better: match by comparing `parcel_code` with the PDOK feature's kadastrale aanduiding fields
**Warning signs:** BRK returns ownership for wrong parcel

### Pitfall 5: BRK Not Configured (Missing PKIOverheid Cert)
**What goes wrong:** Modal shows generic error instead of helpful admin message
**Why it happens:** BRK requires PKIOverheid mTLS certificate which may not be configured yet
**How to avoid:** `fetch_brk_ownership()` already returns `status: "unavailable"` with `admin_hint`. Frontend should show a distinct "not configured" state vs. "API error" state
**Warning signs:** All eigendom requests return "unavailable"

### Pitfall 6: AVG Compliance - Never Show Personal Names
**What goes wrong:** Accidentally displaying personal names or addresses from BRK response
**Why it happens:** BRK V2 response may contain `NatuurlijkPersoon` details
**How to avoid:** Existing `ZakelijkGerechtigde` schema already strips names -- only exposes `eigenaar_type`. Never add name/address fields to the schema
**Warning signs:** Personal data visible in UI

## Code Examples

### Backend: Endpoint Pattern (for scans router)
```python
# Source: existing project patterns (scans/router.py, property_aggregator.py)
@router.get("/parcels/{parcel_id}/eigendom")
@limiter.limit("30/minute")
async def get_parcel_eigendom(
    request: Request,
    parcel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """On-demand BRK ownership lookup for a single parcel.

    CRITICAL: Response is ephemeral -- never cached, never stored.
    """
    # 1. Look up parcel (org-scoped)
    parcel = await db.get(ParcelCache, parcel_id)
    if not parcel or parcel.organization_id != current_user.organization_id:
        raise HTTPException(404, "Perceel niet gevonden")

    # 2. Extract centroid in RD (EPSG:28992)
    result = await db.execute(
        select(
            func.ST_X(func.ST_Centroid(ParcelCache.geometry)),
            func.ST_Y(func.ST_Centroid(ParcelCache.geometry)),
        ).where(ParcelCache.id == parcel_id)
    )
    x, y = result.one()

    # 3. Resolve PDOK cadastral identificatie
    async with httpx.AsyncClient() as client:
        pdok = PDOKCadastralClient()
        features = await pdok.get_parcels_by_point(x, y, client, distance=1.0)

    if not features:
        return BRKOwnership(
            status="unavailable",
            reason="Kadastraal perceel niet gevonden in PDOK",
        ).model_dump(mode="json")

    # 4. Extract identificatie from first matching feature
    props = features[0].get("properties", {})
    identificatie = props.get("identificatie")
    if not identificatie:
        return BRKOwnership(
            status="unavailable",
            reason="Kadastrale identificatie niet beschikbaar",
        ).model_dump(mode="json")

    # 5. Call existing BRK ownership fetch
    parcel_obj = CadastralParcel(identificatie=identificatie)
    ownership = await fetch_brk_ownership([parcel_obj])

    return ownership.model_dump(mode="json")
```

### Frontend: Ephemeral Query Hook
```typescript
// Source: project pattern (useScans.ts useParcelEnrichment)
export function useEigendomLookup(parcelId: string) {
  return useQuery({
    queryKey: ['brk-eigendom', parcelId],
    queryFn: async () => {
      const res = await apiFetch(`/api/scans/parcels/${parcelId}/eigendom`)
      if (!res.ok) throw new Error('Eigendom ophalen mislukt')
      return res.json() as Promise<BRKOwnershipResponse>
    },
    enabled: false,    // Manual trigger only
    staleTime: 0,      // Always stale (never auto-reuse)
    gcTime: 0,         // Discard on unmount (Kadaster Tier 3)
    retry: false,      // Don't auto-retry paid API calls
  })
}
```

### Frontend: Confirmation Dialog Pattern
```typescript
// Source: project pattern (Aura design system)
function EigendomConfirmDialog({ onConfirm, onCancel }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-[24px] bg-white p-6 shadow-xl max-w-sm"
    >
      <h3 className="text-lg font-bold text-[#0E1111]">Eigendom opvragen</h3>
      <p className="mt-2 text-sm text-slate-500">
        Kost 1 credit. Data wordt niet opgeslagen en is eenmalig zichtbaar.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="...">Annuleren</button>
        <button onClick={onConfirm} className="...bg-[#0E1111] text-white...">
          Opvragen
        </button>
      </div>
    </motion.div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BRK data fetched during report aggregation only | On-demand standalone endpoint | Phase 105 (new) | Users can check ownership without generating a full report |
| Report-embedded BRK display | Ephemeral modal display | Phase 105 (new) | Compliant with Kadaster Tier 3 never-store terms |

**Existing BRK infrastructure (already built):**
- `backend/app/government_apis/brk_bevragen.py` -- mTLS client singleton
- `backend/app/schemas/brk_ownership.py` -- Pydantic schemas with never_cache marker
- `backend/app/services/property_aggregator.py` -- `fetch_brk_ownership()` + `_parse_perceel_ownership()`
- `backend/app/government_apis/rate_limiter.py` -- `brk_limiter` (2 concurrent, 200/hour)
- `backend/tests/unit/test_brk_bevragen.py` -- 5 unit tests
- `backend/tests/integration/test_brk_wiring.py` -- 5 integration tests (strip-before-save, degradation)

## Open Questions

1. **Gemeente Grondzaken Auto-Lookup**
   - What we know: The CONTEXT.md mentions auto-deriving gemeente grondzaken contact from gemeente code
   - What's unclear: No public API exists for gemeente department contact info. gemeenten.nl has contact pages but no structured API
   - Recommendation: Use a static mapping for the most common gemeenten, or show a generic "Neem contact op met de afdeling Grondzaken van gemeente {naam}" with a link to the gemeente website. Don't spend time building a scraper

2. **Credit System**
   - What we know: Confirmation dialog mentions "Kost 1 credit"
   - What's unclear: No credit/billing system exists in the codebase yet
   - Recommendation: Show the text as designed (future-proofing) but don't implement actual credit deduction. The BRK API cost is on the Propdex side, not charged to users yet

3. **Parcel Code to BRK ID Resolution Reliability**
   - What we know: PDOK point lookup with 1m distance should return the correct parcel
   - What's unclear: Edge cases at parcel boundaries, split parcels, or very small parcels
   - Recommendation: If PDOK returns multiple features, match by comparing `parcel_code` with the PDOK feature's `kadastrale_gemeente_waarde + sectie + perceelnummer` to pick the correct one

## Sources

### Primary (HIGH confidence)
- `backend/app/government_apis/brk_bevragen.py` -- Existing BRK client, verified in codebase
- `backend/app/schemas/brk_ownership.py` -- Existing ownership schemas, verified in codebase
- `backend/app/services/property_aggregator.py` -- `fetch_brk_ownership()` implementation, verified in codebase
- `backend/app/government_apis/pdok_cadastral.py` -- PDOK Cadastral client, verified in codebase
- `backend/app/models/parcel_cache.py` -- ParcelCache model with Tier 3 comments, verified in codebase
- `backend/tests/unit/test_brk_bevragen.py` -- Unit tests, verified in codebase
- `backend/tests/integration/test_brk_wiring.py` -- Integration tests with BRK V2 response format, verified in codebase

### Secondary (MEDIUM confidence)
- [Kadaster BRK Bevragen product page](https://www.kadaster.nl/zakelijk/producten/eigendom/brk-bevragen) -- API overview
- [BRK-bevragen GitHub repository](https://github.com/kadaster/BRK-bevragen) -- OpenAPI specs and documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- existing BRK infrastructure covers ~80% of backend work
- Pitfalls: HIGH -- parcel_code vs identificatie gap verified by reading actual code paths
- Frontend: MEDIUM -- modal patterns are straightforward but exact BRK response fields for display depend on real API data

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- BRK V2 API and existing codebase are mature)
