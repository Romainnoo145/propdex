---
phase: 25-results-interface
plan: 05
subsystem: results-ui/backend-api
tags: [ui, modal, enrichment, sru-api, tier-2-data, on-demand, react-query, fastapi]

dependency_graph:
  requires:
    - "ResultsTable with row selection and double-click (25-02, 25-04)"
    - "SRU bekendmakingen client (backend/app/government_apis/sru_bekendmakingen.py)"
    - "ParcelCache model with enrichment_data JSONB field"
    - "Modal component from ui/Modal.tsx"
  provides:
    - "GET /api/scans/parcels/{parcel_id}/enrich backend endpoint"
    - "ParcelDetailModal with Tier 1 + Tier 2 data"
    - "ParcelEnrichmentCard expandable vergunningen component"
    - "useParcelEnrichment React Query hook with 7-day cache"
    - "fetchParcelEnrichment API function"
  affects:
    - "Future export features may include enrichment data"
    - "URL state persistence (next plan) may include modal state"

tech_stack:
  added: []
  patterns:
    - "On-demand data fetching with React Query enabled flag"
    - "7-day client + server cache alignment for enrichment"
    - "Native HTML details/summary for expandable sections"
    - "Tier 1 (immediate) vs Tier 2 (on-demand) data architecture"
    - "Postcode extraction from address via regex"
    - "SRU API integration for official government publications"
    - "Modal-triggered data fetching (enabled: isOpen pattern)"

key_files:
  created:
    - "frontend/src/components/results/ParcelDetailModal.tsx"
    - "frontend/src/components/results/ParcelEnrichmentCard.tsx"
  modified:
    - "backend/app/scans/router.py"
    - "backend/app/scans/schemas.py"
    - "frontend/src/lib/types/scan.ts"
    - "frontend/src/lib/api.ts"
    - "frontend/src/hooks/useScans.ts"
    - "frontend/src/components/results/ResultsLayout.tsx"
    - "frontend/src/components/results/ResultsTable.tsx"

decisions:
  - name: "On-demand enrichment (not pre-loaded with scan results)"
    rationale: "Vergunningen are not critical for initial filtering/sorting. Fetch only when user opens detail modal. Reduces scan time and API load."
    alternatives: ["Fetch enrichment during scan for all parcels", "Fetch enrichment on first table display"]
    chosen: "Modal-triggered fetch - only enrich parcels user actually views"

  - name: "7-day cache duration for enrichment"
    rationale: "Official publications don't change frequently. 7 days balances freshness vs API load. Matches typical user research cadence."
    alternatives: ["30-day cache", "No cache (always fresh)", "1-day cache"]
    chosen: "7-day cache (server + client aligned)"

  - name: "Postcode extraction from address field (not separate field)"
    rationale: "Postcode already exists in address string from BAG. No need for separate field. Simple regex extraction works reliably for Dutch postcodes."
    alternatives: ["Add postcode column to ParcelCache", "Query BAG API for postcode"]
    chosen: "Regex extraction from address - simple, no schema change"

  - name: "Native details/summary for expandable vergunningen"
    rationale: "HTML native elements provide accessibility, keyboard navigation, and semantics out of the box. No JS framework overhead."
    alternatives: ["Custom accordion with state", "Always-expanded list"]
    chosen: "Native details/summary - accessible, performant, semantic"

  - name: "Double-click to open modal (not single-click or button)"
    rationale: "Single-click already used for selection/map sync (25-04). Double-click is intuitive desktop pattern for 'open/details'. Row contains all needed data."
    alternatives: ["Add expand icon button in each row", "Single-click opens modal (no selection)"]
    chosen: "Double-click on row - minimal UI clutter, familiar pattern"

metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_created: 2
  files_modified: 7
  commits: 2
  completed_date: "2026-02-15"
---

# Phase 25 Plan 05: Parcel Detail Modal Summary

**One-liner:** Double-click table row to open detail modal showing Tier 1 data immediately + on-demand Tier 2 vergunningen enrichment via SRU API with 7-day cache.

## What Was Built

Implemented the parcel detail modal with on-demand Tier 2 enrichment, enabling users to dive deep into individual parcels with official government vergunningen data. The modal displays immediate Tier 1 data (score, area, bestemmingen) and fetches Tier 2 enrichment (vergunningen via SRU) only when opened, with 7-day server and client-side caching.

### Key Components

**Backend: Enrichment Endpoint** (`backend/app/scans/router.py` +125 lines)

**New Endpoint:** `GET /api/scans/parcels/{parcel_id}/enrich`
- **Auth:** JWT required, multi-tenant isolated via organization_id
- **Rate limit:** 30/minute
- **Response schema:** `ParcelEnrichmentResponse` with enrichment_data, enriched_at, is_cached

**Implementation flow:**
1. Query `ParcelCache` by `id` and `organization_id` (404 if not found)
2. Check freshness: `enriched_at` exists AND `(now - enriched_at).days < 7`
3. If fresh: return cached data with `is_cached=True`
4. If stale or missing:
   - Extract postcode from `parcel.address` using regex `\b(\d{4}\s?[A-Z]{2})\b`
   - Remove space from postcode for SRU query format ("1234AB")
   - If no postcode: return `{"vergunningen": [], "error": "Postcode niet gevonden"}`
   - Query SRU API: `sru_client.query_by_postcode(postcode, max_records=20)`
   - Store result: `parcel.enrichment_data = {"vergunningen": [dict(r) for r in records]}`
   - Set `parcel.enriched_at = datetime.utcnow()`
   - Commit to DB
   - Return with `is_cached=False`
5. Error handling: Catch `GovernmentAPIError`, log, store error in enrichment_data

**Schema addition:** `ParcelEnrichmentResponse` in `backend/app/scans/schemas.py`
- Fields: `parcel_id` (UUID), `enrichment_data` (dict | None), `enriched_at` (datetime | None), `is_cached` (bool)

**Frontend: Types and API** (`frontend/src/lib/types/scan.ts` +43 lines)

**New Types:**
- `BekendmakingRecord` - Single vergunning from SRU API
  - Fields: title, identifier, type, date, municipality, url
- `ParcelEnrichmentResponse` - Enrichment response from backend
  - Fields: parcel_id, enrichment_data (with vergunningen array + optional error), enriched_at, is_cached

**API Function** (`frontend/src/lib/api.ts` +18 lines):
```typescript
fetchParcelEnrichment(parcelId: string, accessToken: string | null): Promise<ParcelEnrichmentResponse>
```

**React Query Hook** (`frontend/src/hooks/useScans.ts` +22 lines):
```typescript
useParcelEnrichment(parcelId: string | null, options?: { enabled?: boolean })
```
- Query key: `['parcel-enrichment', parcelId]`
- Stale time: 7 days (matches backend cache)
- Enabled only when: `parcelId` exists AND `accessToken` exists AND `options.enabled !== false`
- Used with `enabled: isOpen` pattern to fetch only when modal opens

**ParcelEnrichmentCard Component** (`frontend/src/components/results/ParcelEnrichmentCard.tsx` 88 lines)

**Purpose:** Expandable card for vergunningen list

**States:**
- **Loading:** Animated skeleton (3 pulse bars)
- **Error:** Orange error message display
- **No vergunningen:** "Geen vergunningen gevonden" muted text
- **Has vergunningen:** Expandable `<details>/<summary>` list

**Expandable list structure:**
- Summary shows: "Vergunningen (count)" + cache status ("Gecached" / "Vers opgehaald")
- Each vergunning item:
  - Title (bold, white/80)
  - Type + Date (text-xs, white/50)
  - Link to official publication (blue-400, opens in new tab)

**Styling:** Glassmorphism (bg-white/5, border-white/10), consistent with Propdex aesthetic

**ParcelDetailModal Component** (`frontend/src/components/results/ParcelDetailModal.tsx` 181 lines)

**Purpose:** Full parcel detail view with Tier 1 + Tier 2 data

**Props:**
- `parcel: ScanResultItem | null` - Parcel data from table
- `isOpen: boolean` - Modal open state
- `onClose: () => void` - Close handler

**Uses:** `Modal` component with size="lg" (max-w-4xl)

**Layout sections:**

1. **Header** (flex justify-between)
   - Parcel code (text-xl, semibold)
   - Address (text-sm, muted)
   - Close button (X icon)

2. **Score Section** (bg-white/5 rounded-lg card)
   - Large circular badge with score (2xl font, green gradient background)
   - Score breakdown with horizontal bars
   - Each factor: name (truncated to fit), progress bar, numeric value

3. **Property Info Grid** (2-column responsive grid)
   - Oppervlak: `{area_m2?.toLocaleString('nl-NL')} m²`
   - Bebouwd: "Ja" / "Nee"
   - Gemeente: gemeente_code (if available)

4. **Bestemmingen Section**
   - Displays all bestemmingen as badge pills
   - Blue gradient styling (bg-blue-500/10, border-blue-400/30)
   - Shows `type` or `naam` from bestemming object

5. **Vergunningen Section (Tier 2)**
   - Fetches enrichment via `useParcelEnrichment(parcel?.parcel_id, { enabled: isOpen })`
   - Renders `<ParcelEnrichmentCard data={enrichment.data} isLoading={enrichment.isLoading} />`
   - Only fetches when modal is open (enabled flag pattern)

**ResultsLayout Updates** (`frontend/src/components/results/ResultsLayout.tsx` +5, -1 lines)

**Changes:**
- Import `ParcelDetailModal` and `ScanResultItem` type
- Add state: `const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)`
- Pass `onRowDoubleClick={(parcel) => setModalParcel(parcel)}` to ResultsTable
- Render modal below PanelGroup: `<ParcelDetailModal parcel={modalParcel} isOpen={!!modalParcel} onClose={() => setModalParcel(null)} />`

**ResultsTable Updates** (`frontend/src/components/results/ResultsTable.tsx` +3, -1 lines)

**Changes:**
- Add prop: `onRowDoubleClick?: (parcel: ScanResultItem) => void`
- Add `onDoubleClick={() => onRowDoubleClick?.(row.original)}` to `<tr>` element
- Double-click passes full parcel object (not just ID) to open modal with all data

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation

### Data Fetching Flow

**User double-clicks table row:**
```
User double-clicks row
  ↓
ResultsTable fires onRowDoubleClick(row.original)
  ↓
ResultsLayout receives parcel object
  ↓
setModalParcel(parcel) updates state
  ↓
ParcelDetailModal isOpen becomes true
  ↓
useParcelEnrichment hook enabled: isOpen=true, parcelId exists
  ↓
React Query checks cache (queryKey: ['parcel-enrichment', parcelId])
  ↓
If stale or missing (staleTime: 7 days):
  ↓
  fetchParcelEnrichment(parcelId, accessToken) called
  ↓
  Backend receives GET /api/scans/parcels/{parcel_id}/enrich
  ↓
  Backend checks ParcelCache.enriched_at freshness
  ↓
  If fresh (< 7 days): return cached enrichment_data with is_cached=true
  ↓
  If stale: extract postcode → query SRU → store result → return with is_cached=false
  ↓
Frontend receives ParcelEnrichmentResponse
  ↓
ParcelEnrichmentCard renders vergunningen list
  ↓
User expands details/summary to view individual vergunningen
```

### Cache Alignment (7 Days)

**Server cache (backend):**
- Stored in `ParcelCache.enrichment_data` JSONB column
- Freshness check: `(datetime.utcnow() - parcel.enriched_at).days < 7`
- If fresh: return cached data immediately (no SRU API call)

**Client cache (frontend):**
- React Query staleTime: `7 * 24 * 60 * 60 * 1000` (7 days in milliseconds)
- If data is within staleTime: return from cache immediately (no HTTP request)
- After 7 days: refetch from backend (which may still return cached if < 7 days server-side)

**Result:** Maximum 7-day data age, minimal API calls, aligned cache invalidation

### Postcode Extraction Pattern

**Regex:** `\b(\d{4}\s?[A-Z]{2})\b`
- `\b` - Word boundary (ensures clean match)
- `\d{4}` - 4 digits
- `\s?` - Optional space
- `[A-Z]{2}` - 2 uppercase letters
- Examples matched: "1234 AB", "1234AB", "5678CD"

**Space removal for SRU:**
```python
postcode = match.group(1).replace(' ', '')  # "1234 AB" → "1234AB"
```

SRU API expects no space in postcode parameter.

### Modal-Triggered Fetching Pattern

**Why `enabled: isOpen` pattern?**
- No fetch until user actually opens modal
- Reduces unnecessary API calls (user may never view detail for most parcels)
- Instant Tier 1 data display (no loading spinner for address/score/area)
- Only Tier 2 data shows loading skeleton (acceptable, non-critical data)

**Alternative approaches considered:**
- Pre-fetch on row hover: Too aggressive, many false positives
- Pre-fetch on row selection: Better, but still fetches for selections user doesn't detail-view
- Always fetch with results: Wasteful, slows scan completion

**Chosen approach benefits:**
- Lazy loading - fetch only what user views
- Clear loading state - only in Tier 2 section
- Tier 1 data always instant (cached from scan results)

## Verification Results

All success criteria met:

1. **npm run check passes:** ✓ (1 expected TanStack Table warning from 25-02)
2. **ruff check backend/app/scans passes:** ✓ (backend files clean)
3. **Double-click row opens modal:** ✓
4. **Modal shows Tier 1 data immediately:** ✓ (parcel code, address, area, bestemming, score breakdown)
5. **Vergunningen section shows loading skeleton initially:** ✓ (3 pulse bars during fetch)
6. **Expandable vergunningen list:** ✓ (native details/summary, title/type/date/link per item)
7. **Cache status indicator:** ✓ ("Gecached" vs "Vers opgehaald" in summary line)
8. **Backend caching works:** ✓ (enrichment_data stored, enriched_at set, 7-day freshness check)
9. **Error handling:** ✓ (missing postcode, SRU failures return error in enrichment_data)
10. **Multi-tenant isolation:** ✓ (organization_id filter in ParcelCache query)

**Expected Warning:**
TanStack Table React Compiler warning still present (known limitation from plan 25-02).

## Files Modified

**Backend:**
- `backend/app/scans/router.py` (+152 lines)
  - Add imports: re, datetime, GovernmentAPIError, sru_client, ParcelCache
  - Add GET /api/scans/parcels/{parcel_id}/enrich endpoint
  - Postcode extraction logic
  - 7-day cache freshness check
  - SRU API integration
  - Error handling for missing postcode and API failures

- `backend/app/scans/schemas.py` (+18 lines)
  - Add ParcelEnrichmentResponse schema
  - Fields: parcel_id, enrichment_data, enriched_at, is_cached

**Frontend:**
- `frontend/src/lib/types/scan.ts` (+43 lines)
  - Add BekendmakingRecord interface
  - Add ParcelEnrichmentResponse interface

- `frontend/src/lib/api.ts` (+18 lines)
  - Import ParcelEnrichmentResponse type
  - Add fetchParcelEnrichment function

- `frontend/src/hooks/useScans.ts` (+22 lines)
  - Import fetchParcelEnrichment and ParcelEnrichmentResponse
  - Add useParcelEnrichment hook with 7-day staleTime

- `frontend/src/components/results/ParcelEnrichmentCard.tsx` (88 lines new file)
  - Loading skeleton state
  - Error display state
  - No vergunningen state
  - Expandable details/summary list
  - Vergunning item rendering (title, type, date, link)

- `frontend/src/components/results/ParcelDetailModal.tsx` (181 lines new file)
  - Modal wrapper with size="lg"
  - Header with parcel code and close button
  - Score section with breakdown bars
  - Property info grid (oppervlak, bebouwd, gemeente)
  - Bestemmingen badge list
  - Vergunningen section with ParcelEnrichmentCard
  - useParcelEnrichment hook with enabled: isOpen

- `frontend/src/components/results/ResultsLayout.tsx` (+5, -1 lines)
  - Import ParcelDetailModal and ScanResultItem
  - Add modalParcel state
  - Pass onRowDoubleClick to ResultsTable
  - Render ParcelDetailModal below PanelGroup

- `frontend/src/components/results/ResultsTable.tsx` (+3, -1 lines)
  - Add onRowDoubleClick prop to interface
  - Add onRowDoubleClick parameter to function
  - Add onDoubleClick handler to table rows

## Next Steps

**Phase 25 Complete:** All 5 plans executed successfully.

**Next Phase:** Phase 26 - Change Monitoring
- Monitor bestemmingsplannen changes over time
- Alert on new vergunningen for watched addresses
- Compare historical scan results
- Ruimtelijkeplannen.nl REST API v4 integration

**Dependencies for Phase 26:**
- Ruimtelijkeplannen.nl API key required (request from Informatiehuis Ruimte)
- Dual parser support for IMRO vs STOP/TPOD formats (TAM-IMRO ends January 1, 2026)
- Webhook or polling architecture for change detection

## Commits

1. **6c70784** - `feat(25-05): add parcel enrichment endpoint with 7-day cache`
   - Add ParcelEnrichmentResponse schema in scans/schemas.py
   - Add GET /api/scans/parcels/{parcel_id}/enrich endpoint
   - Extract postcode from parcel address using regex
   - Query SRU API for vergunningen by postcode (max 20 records)
   - Cache enrichment_data in ParcelCache for 7 days
   - Return is_cached flag to indicate fresh vs cached data
   - Multi-tenant isolation via organization_id filter
   - Rate limited to 30/minute
   - Error handling for missing postcode and SRU failures

2. **ac3f0fd** - `feat(25-05): add parcel detail modal with on-demand tier 2 enrichment`
   - Add ParcelEnrichmentResponse and BekendmakingRecord types to scan.ts
   - Add fetchParcelEnrichment API function
   - Add useParcelEnrichment React Query hook with 7-day staleTime
   - Create ParcelEnrichmentCard component with expandable vergunningen list
   - Uses native details/summary HTML elements
   - Shows loading skeleton during fetch
   - Displays error messages or "geen vergunningen" states
   - Shows cached vs fresh status
   - Create ParcelDetailModal component (size="lg")
   - Shows Tier 1 data immediately (address, area, bestemming, score breakdown)
   - Fetches Tier 2 enrichment on-demand when modal opens (enabled: isOpen)
   - Displays score with visual breakdown bars
   - Property info grid (oppervlak, bebouwd, gemeente)
   - Bestemmingen as badge list
   - Vergunningen section with ParcelEnrichmentCard
   - Wire modal into ResultsLayout
   - Add modalParcel state
   - Pass onRowDoubleClick to ResultsTable
   - Render ParcelDetailModal below PanelGroup
   - Update ResultsTable to accept onRowDoubleClick prop
   - Add onDoubleClick handler to table rows
   - Opens modal with full parcel object

---

## Self-Check: PASSED

All claims verified:

**Backend:**
- ParcelEnrichmentResponse schema exists in backend/app/scans/schemas.py ✓
- GET /api/scans/parcels/{parcel_id}/enrich endpoint exists in backend/app/scans/router.py ✓
- Postcode extraction regex implemented ✓
- 7-day cache freshness check implemented ✓
- SRU API integration working ✓
- Multi-tenant isolation via organization_id ✓
- Error handling for missing postcode and SRU failures ✓
- ruff check passes on modified files ✓

**Frontend:**
- BekendmakingRecord and ParcelEnrichmentResponse types added ✓
- fetchParcelEnrichment API function exists ✓
- useParcelEnrichment hook with 7-day staleTime exists ✓
- ParcelEnrichmentCard component created ✓
- ParcelDetailModal component created ✓
- Modal wired into ResultsLayout ✓
- ResultsTable accepts onRowDoubleClick prop ✓
- npm run check passes (1 expected TanStack warning) ✓

**Commits:**
- Commit 6c70784 exists ✓
- Commit ac3f0fd exists ✓

**Files:**
- backend/app/scans/router.py modified ✓
- backend/app/scans/schemas.py modified ✓
- frontend/src/lib/types/scan.ts modified ✓
- frontend/src/lib/api.ts modified ✓
- frontend/src/hooks/useScans.ts modified ✓
- frontend/src/components/results/ParcelEnrichmentCard.tsx created ✓
- frontend/src/components/results/ParcelDetailModal.tsx created ✓
- frontend/src/components/results/ResultsLayout.tsx modified ✓
- frontend/src/components/results/ResultsTable.tsx modified ✓

---

**Plan Status:** COMPLETE
**Execution Time:** 5 minutes
**Issues:** None
