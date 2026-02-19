# Phase 40: Report Integration - Research

**Researched:** 2026-02-19
**Domain:** FastAPI endpoint integration + React mutation hook + progress UX
**Confidence:** HIGH

---

## Summary

Phase 40 adds a "Genereer rapport" action to two existing surfaces — the `ResultsTable` row (via the double-click `ParcelDetailModal`) and the `InspectorPanel` on the map. The action calls a new `POST /api/reports/from-parcel` backend endpoint that:

1. Loads the `ParcelCache` record to get the parcel's display address string.
2. Parses that string to extract a Dutch postcode + huisnummer suitable for `AddressInput`.
3. Calls the existing `aggregate_property_data(...)` pipeline (BAG, PDOK, DSO, RCE, SRU) which returns a `PropertyReportResponse`.
4. Passes the result directly to the existing `service.save_report(...)` function, saving a `SavedReport` row.
5. Returns the `ReportDetailResponse` (same schema as `POST /api/reports`).

No new dependencies are required on either the backend or frontend. The entire flow reuses existing infrastructure. The critical design challenge is parsing the `parcel.address` string into a structured `AddressInput` — this string comes from PDOK Locatieserver `/reverse` and has a known format: `"{straat} {nummer}, {postcode}{letters} {woonplaats}"` (e.g., "Kerkstraat 42, 5911AA Venlo"). The regex `r'(\d{4})\s*([A-Z]{2})'` and `r'(\d+)'` applied to this string reliably extracts postcode and huisnummer.

**Primary recommendation:** Add one new endpoint `POST /api/reports/from-parcel` in the existing reports router, add one new `useGenerateReportFromParcel` mutation hook, and add a "Genereer rapport" button to `ParcelDetailModal` and `InspectorPanel`. Progress feedback uses `sonner` toast in loading state (same pattern as `SaveReportFlow`).

---

## Standard Stack

### Core (all already in project — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | existing | Endpoint routing, dependency injection | Already in use |
| SQLAlchemy 2.x async | existing | `Mapped[type]` + `mapped_column()` pattern | Already in use |
| Pydantic v2 | existing | Request/response validation, `model_validate()` | Already in use |
| TanStack Query v5 | existing | `useMutation`, `useQueryClient` for cache invalidation | Already in use |
| sonner | existing | Toast notifications during loading/success/error | Already in use |
| httpx | existing | Shared `http_client` from `app.state` | Already in use |

### No New Dependencies

Per v5.0 roadmap decision: "No new dependencies required — report-from-parcel reuses existing property_aggregator." This is confirmed by code audit: all necessary functions, schemas, and services already exist.

---

## Architecture Patterns

### Backend: New Endpoint in Existing Router

Add `POST /api/reports/from-parcel` at the TOP of `backend/app/reports/router.py`, before the `/{report_id}` routes. Static sub-paths must come before parameterized paths.

**Request schema (new, in `backend/app/schemas/report.py`):**
```python
class ReportFromParcelRequest(BaseModel):
    """Schema for generating a report from a scan result parcel."""
    parcel_id: uuid.UUID = Field(description="ParcelCache UUID")
    notes: str | None = Field(default=None)
    project_id: uuid.UUID | None = Field(default=None)
```

**Response schema:** Reuse existing `ReportDetailResponse` (already defined, already imported).

### Backend: Address Parsing Pattern

The `parcel.address` field is populated by `PDOKLocatieserver.reverse()` which returns `weergavenaam` — a display string from PDOK Locatieserver. The format is documented as: `"{straatnaam} {huisnummer}, {postcode} {woonplaats}"` (e.g., `"Kerkstraat 42, 5911AA Venlo"` or `"Kerkstraat 42a, 5911 AA Venlo"`). Some addresses may have a huisletter directly after huisnummer.

**Extraction approach:**
```python
import re

def parse_address_string(address: str) -> tuple[str, int] | None:
    """
    Parse PDOK weergavenaam to (postcode, huisnummer).

    Format: "{straat} {hn}, {postcode} {woonplaats}"
    E.g.: "Kerkstraat 42, 5911AA Venlo"
    E.g.: "Kerkstraat 42a bis, 5911 AA Venlo"
    """
    # Extract postcode (4 digits + optional space + 2 uppercase letters)
    postcode_match = re.search(r'(\d{4}\s?[A-Z]{2})', address.upper())
    if not postcode_match:
        return None

    # Extract huisnummer: first number after street name
    # Pattern: street name, then space, then digits, optionally followed by letter/toevoeging
    # Use the number that comes immediately before the comma
    pre_comma = address.split(',')[0] if ',' in address else address
    hn_match = re.search(r'(\d+)', pre_comma)
    if not hn_match:
        return None

    postcode = postcode_match.group(1).replace(' ', '')
    # Normalize to "1234 AB" format
    postcode_normalized = f"{postcode[:4]} {postcode[4:]}"
    huisnummer = int(hn_match.group(1))
    return postcode_normalized, huisnummer
```

If parsing fails (address is None or no match), raise `HTTP 422 Unprocessable Entity` with detail `"Geen geldig adres beschikbaar voor dit perceel"`.

### Backend: Service Flow

```python
# In reports/router.py
@router.post("/from-parcel", response_model=ReportDetailResponse, status_code=201)
@limiter.limit("10/minute")
async def generate_report_from_parcel(
    request: Request,
    body: ReportFromParcelRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    # 1. Load parcel (with org isolation)
    # 2. Parse address string -> AddressInput
    # 3. Call aggregate_property_data(...)
    # 4. Call service.save_report(...)
    # 5. Return ReportDetailResponse
```

Key dependencies passed in:
- `client = request.app.state.http_client`
- `arq_pool = request.app.state.arq_pool`

### Frontend: New Hook in `useReports.ts`

Add `useGenerateReportFromParcel` as a `useMutation` that calls a new `generateReportFromParcel(parcelId, accessToken)` function in `lib/api.ts`. Invalidates `['reports']` query key on success.

```typescript
// lib/api.ts
export async function generateReportFromParcel(
  parcelId: string,
  accessToken: string | null,
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>('/api/reports/from-parcel', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ parcel_id: parcelId }),
  })
}

// hooks/useReports.ts
export function useGenerateReportFromParcel() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ReportDetailResponse, Error, string>({
    mutationFn: (parcelId: string) =>
      generateReportFromParcel(parcelId, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
```

### Frontend: UX Pattern for Progress Feedback

Use `sonner` toast with loading/success/error states, identical to `SaveReportFlow.tsx`:

```typescript
const toastId = toast.loading('Rapport wordt gegenereerd...')
try {
  const result = await generateMutation.mutateAsync(parcelId)
  toast.success('Rapport opgeslagen in Rapporten', { id: toastId })
} catch (error) {
  const message = error instanceof Error ? error.message : 'Genereren mislukt'
  toast.error(message, { id: toastId })
}
```

### Recommended Project Structure Changes

```
backend/app/
├── reports/
│   ├── router.py          # Add POST /from-parcel endpoint (before /{report_id})
│   └── (no other files change)
├── schemas/
│   └── report.py          # Add ReportFromParcelRequest schema

frontend/src/
├── lib/
│   └── api.ts             # Add generateReportFromParcel() function
├── hooks/
│   └── useReports.ts      # Add useGenerateReportFromParcel() hook
└── components/
    └── results/
        └── ParcelDetailModal.tsx   # Add "Genereer rapport" button
    └── layout/
        └── InspectorPanel.tsx      # Add "Genereer rapport" button
```

### Anti-Patterns to Avoid

- **Don't add a new separate pipeline:** `aggregate_property_data` already does everything. Call it directly, don't duplicate.
- **Don't bypass `service.save_report`:** It validates `PropertyReportResponse`, generates `report_name`, extracts denormalized `postcode`/`city`. Always use it.
- **Don't use `async with db.begin()`:** Project-wide pattern is `db.add() / db.flush() / db.commit()`. Using `async with db.begin()` causes "transaction already begun" error.
- **Don't add loading spinner inside InspectorPanel:** The InspectorPanel has no async loading state currently. Use `sonner` toast instead — consistent with existing pattern.
- **Don't open a new route/page:** The report appears in the existing Rapporten view. No new navigation needed; just show a success toast with the report name.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Property data aggregation | Custom API fetch chain | `aggregate_property_data()` | Already handles BAG→PDOK→DSO→RCE→SRU pipeline, partial failures, caching, ARQ |
| Saving reports | Custom DB insert | `service.save_report()` | Validates schema, generates report_name, extracts denormalized fields |
| Progress feedback | Custom loading overlay | `sonner` toast (already imported) | Already used throughout for async operations |
| Toast notifications | Custom toast component | `sonner` (already in project) | Project standard, already installed |
| Query cache invalidation | Manual refetch | `queryClient.invalidateQueries(['reports'])` | TanStack Query standard pattern |
| Auth injection | Manual header building | `apiFetch()` + `useAuth()` | Project standard authenticated fetch wrapper |

**Key insight:** Every building block already exists. This phase is purely integration work — connecting `ParcelCache` → `AddressInput` → `aggregate_property_data` → `service.save_report`.

---

## Common Pitfalls

### Pitfall 1: Static Route Before Parameterized Route

**What goes wrong:** FastAPI matches `GET /api/reports/from-parcel` as `GET /api/reports/{report_id}` and tries to parse "from-parcel" as a UUID → HTTP 422.

**Why it happens:** FastAPI matches routes in declaration order. The `POST /from-parcel` route must be declared BEFORE the `/{report_id}` routes in `router.py`.

**How to avoid:** Add the new endpoint at the TOP of `router.py`, before line 223 where `@router.get("/{report_id}", ...)` starts. Since the method is POST and the ID routes are GET/DELETE/POST/{id}/..., there's no actual conflict for POST — but it's best practice to always place static sub-paths first.

**Warning signs:** 422 Unprocessable Entity with detail about UUID parsing.

### Pitfall 2: Address Parsing Failure

**What goes wrong:** `parcel.address` is `None` (parcel had no reverse geocode match during scan) or has an unexpected format. Endpoint crashes or returns wrong address.

**Why it happens:** During area scans, not all parcels get a reverse geocode result. `REVERSE_GEOCODE_CONCURRENCY = 10` plus async failures can leave `address = None`. PDOK weergavenaam format also varies slightly (postcode with/without space, addresses with bus/bis suffixes).

**How to avoid:**
1. Check `parcel.address is None` first — raise HTTP 422 with clear Dutch message.
2. Use robust regex: `r'(\d{4}\s?[A-Z]{2})'` for postcode, `r'(\d+)'` on pre-comma portion for huisnummer.
3. Validate extracted huisnummer is > 0.
4. Unit test the parser with edge cases: "Straat 12a, 1234AB Stad", "Straat 12 bis, 1234 AB Stad", None.

**Warning signs:** HTTP 422 in production; reports with wrong address in Rapporten view.

### Pitfall 3: Transaction Already Begun

**What goes wrong:** Using `async with db.begin():` block inside the endpoint causes `InvalidRequestError: A transaction is already begun`.

**Why it happens:** FastAPI's `get_db` dependency already starts a transaction. Nesting a `begin()` block fails in SQLAlchemy 2.x with the project's async session configuration.

**How to avoid:** Use the established pattern: `session.add(obj)` → `await session.flush()` → `await session.commit()`. This is what `service.save_report()` already does — so just calling that function handles it correctly.

**Warning signs:** 500 Internal Server Error with SQLAlchemy transaction error in logs.

### Pitfall 4: ARQ Pool Not Provided

**What goes wrong:** `aggregate_property_data` receives `arq_pool=None`, skips AI parsing, but still works. This is acceptable behavior (ai_parsing section returns `not_available`).

**Why it happens:** If `arq_pool` is not passed, the aggregator falls back gracefully. The endpoint should always pass `request.app.state.arq_pool` to enable AI parsing.

**How to avoid:** Always pass `arq_pool=request.app.state.arq_pool` in the endpoint. The aggregator handles the case where no plan_idn is found gracefully.

### Pitfall 5: Rate Limit Too Permissive

**What goes wrong:** Report generation from parcels triggers expensive parallel API calls (BAG + PDOK + DSO + RCE). If users spam-click from a results table of 500 parcels, this could overload upstream APIs.

**Why it happens:** Each `aggregate_property_data` call makes 4+ external API calls. `POST /api/properties/lookup` uses `30/minute`. Report generation is at least as expensive.

**How to avoid:** Use `@limiter.limit("10/minute")` for `POST /from-parcel`. This matches the `PUT /{report_id}/refresh` limit, which is also a data-fetching operation.

### Pitfall 6: EPSG:28992 Geometry in Report Response

**What goes wrong:** The `CadastralParcel.geometry` in `PropertyReportResponse` contains GeoJSON. If the geometry comes from cached `parcel_cache.geometry` directly (which is stored in EPSG:28992), coordinates will be in RD New, not WGS84.

**Why it happens:** Per prior decisions: "parcel_cache.geometry is EPSG:28992; always use ST_Transform(geometry, 4326) before GeoJSON serialization."

**How to avoid:** The `aggregate_property_data` pipeline handles this — it fetches geometries from the PDOK Cadastral API (which returns WGS84), not from `parcel_cache.geometry`. The aggregator gets a fresh parcel geometry from the live API. No special handling needed in the new endpoint since the pipeline is called fresh.

### Pitfall 7: Duplicate Report Generation

**What goes wrong:** User clicks "Genereer rapport" twice quickly, creating two reports for the same parcel.

**Why it happens:** No idempotency check — `service.save_report` always creates a new row.

**How to avoid:** Disable the button while `isPending` is true (TanStack Query provides this). Add `disabled={generateMutation.isPending}` to the button.

---

## Code Examples

### Backend: Complete Endpoint Pattern

```python
# Source: backend/app/reports/router.py (new endpoint, follows existing pattern)
import re

@router.post("/from-parcel", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def generate_report_from_parcel(
    request: Request,
    body: ReportFromParcelRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """Generate and save a full property intelligence report from a scan parcel."""
    # 1. Load parcel with org isolation
    result = await db.execute(
        select(ParcelCache).where(
            ParcelCache.id == body.parcel_id,
            ParcelCache.organization_id == organization_id,
        )
    )
    parcel = result.scalar_one_or_none()
    if parcel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel not found")

    # 2. Parse address string -> structured AddressInput
    if not parcel.address:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Geen geldig adres beschikbaar voor dit perceel",
        )

    parsed = _parse_parcel_address(parcel.address)
    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Adres kan niet worden verwerkt: {parcel.address}",
        )

    postcode, huisnummer = parsed
    address_input = AddressInput(postcode=postcode, huisnummer=huisnummer)

    # 3. Run aggregator pipeline
    client = request.app.state.http_client
    arq_pool = request.app.state.arq_pool

    try:
        property_data = await aggregate_property_data(
            input_data=address_input,
            client=client,
            organization_id=organization_id,
            session=db,
            force_refresh=False,
            arq_pool=arq_pool,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Fout bij ophalen van perceeldata: {e}",
        ) from e

    # 4. Save report (reuses existing service)
    report = await service.save_report(
        report_data=property_data.model_dump(mode="json"),
        notes=body.notes,
        project_id=body.project_id,
        organization_id=organization_id,
        session=db,
    )

    # 5. Return ReportDetailResponse
    return ReportDetailResponse(
        id=report.id,
        report_name=report.report_name,
        report_data=report.report_data,
        postcode=report.postcode,
        city=report.city,
        notes=report.notes,
        project_id=report.project_id,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


def _parse_parcel_address(address: str) -> tuple[str, int] | None:
    """
    Parse PDOK weergavenaam to (postcode, huisnummer).

    PDOK reverse format: "{straat} {huisnummer}, {postcode} {woonplaats}"
    Examples:
      "Kerkstraat 42, 5911AA Venlo"       -> ("5911 AA", 42)
      "Kerkstraat 42a, 5911 AA Venlo"     -> ("5911 AA", 42)
      "Dorpsstraat 1 bis, 1234 AB Stad"   -> ("1234 AB", 1)
    """
    upper = address.upper()

    # Extract postcode: 4 digits + optional space + 2 letters
    postcode_match = re.search(r'(\d{4})\s*([A-Z]{2})\b', upper)
    if not postcode_match:
        return None
    postcode = f"{postcode_match.group(1)} {postcode_match.group(2)}"

    # Extract huisnummer: first number sequence before the comma
    pre_comma = address.split(',')[0] if ',' in address else address
    hn_match = re.search(r'(\d+)', pre_comma)
    if not hn_match:
        return None

    huisnummer = int(hn_match.group(1))
    if huisnummer <= 0:
        return None

    return postcode, huisnummer
```

### Frontend: Button in ParcelDetailModal

```typescript
// Source: frontend/src/components/results/ParcelDetailModal.tsx
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { toast } from 'sonner'

// Inside ParcelDetailModal component:
const generateReport = useGenerateReportFromParcel()

const handleGenerateReport = async () => {
  if (!parcel?.parcel_id) return
  const toastId = toast.loading('Rapport wordt gegenereerd...')
  try {
    await generateReport.mutateAsync(parcel.parcel_id)
    toast.success('Rapport opgeslagen in Rapporten', { id: toastId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Genereren mislukt'
    toast.error(message, { id: toastId })
  }
}

// Button to add in modal footer or action section:
<button
  onClick={handleGenerateReport}
  disabled={generateReport.isPending}
  className="w-full py-2.5 px-4 bg-amber-accent text-grey-900 font-medium rounded
             hover:bg-amber-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors text-sm"
>
  {generateReport.isPending ? 'Bezig...' : 'Genereer rapport'}
</button>
```

### Frontend: Button in InspectorPanel

```typescript
// Source: frontend/src/components/layout/InspectorPanel.tsx
// Add to bottom of content section when parcel is set:
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'

// Inside InspectorPanel component:
const generateReport = useGenerateReportFromParcel()

const handleGenerateReport = async () => {
  if (!parcel?.parcel_id) return
  const toastId = toast.loading('Rapport wordt gegenereerd...')
  try {
    await generateReport.mutateAsync(parcel.parcel_id)
    toast.success('Rapport opgeslagen in Rapporten', { id: toastId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Genereren mislukt'
    toast.error(message, { id: toastId })
  }
}

// Button (added after score_category section, before closing div):
<button
  onClick={handleGenerateReport}
  disabled={generateReport.isPending}
  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4
             bg-amber-accent text-grey-900 font-medium rounded text-sm
             hover:bg-amber-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors min-h-[44px]"
>
  <FileText size={14} />
  {generateReport.isPending ? 'Bezig...' : 'Genereer rapport'}
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual transaction `async with db.begin()` | `db.add() / flush() / commit()` | v4.0 | Critical: nesting breaks |
| `datetime.now(timezone.utc)` | `datetime.utcnow()` | v1.0 | TIMESTAMP WITHOUT TIME ZONE mismatch |
| New endpoint in new router file | New endpoint in existing `reports/router.py` | v5.0 roadmap | Keep existing routing prefix |

**Not deprecated:**
- `PropertyReportResponse.model_validate()` — Pydantic v2 pattern, correct
- `session.add() / flush() / commit()` — project standard, do not change

---

## Open Questions

1. **huisletter / toevoeging in address string**
   - What we know: PDOK weergavenaam sometimes includes huisletter directly after huisnummer (e.g., "Straat 42a"). The `_parse_parcel_address` regex extracts only the numeric part, ignoring letters. `AddressInput.huisletter` would be `None`.
   - What's unclear: Would a lookup for "Straat 42" without "a" succeed when the actual address is "42a"? BAG usually allows this — huisnummer 42 may return the base address.
   - Recommendation: Accept this limitation for v5.0. If BAG returns a 404 for the bare number, the endpoint returns HTTP 502 with a meaningful message. Log the full address string for debugging. Can be improved in a future phase.

2. **Address-less parcels (no reverse geocode result)**
   - What we know: During area scans, some parcels get `address = None` because `PDOK /reverse` returned no result (bare land, industrial zones, parcels > 100m from any address).
   - What's unclear: What percentage of qualifying parcels have no address? This could make the button frustrating if it frequently fails.
   - Recommendation: Return HTTP 422 with clear Dutch message. Show the error via `toast.error`. The button is still visible but the error explains why. This is acceptable for v5.0.

3. **ARQ pool availability in the endpoint**
   - What we know: `request.app.state.arq_pool` is set in `main.py` during startup. All other endpoints that need it access it the same way.
   - What's unclear: Nothing — this pattern is established and working.
   - Recommendation: No action needed; access via `request.app.state.arq_pool` as documented.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit — `backend/app/reports/router.py` — existing endpoint patterns, response schemas
- Direct codebase audit — `backend/app/reports/service.py` — `save_report()` signature and DB commit pattern
- Direct codebase audit — `backend/app/services/property_aggregator.py` — `aggregate_property_data()` full signature
- Direct codebase audit — `backend/app/models/parcel_cache.py` — `ParcelCache` model fields
- Direct codebase audit — `backend/app/scans/router.py` — `enrich_parcel` pattern (regex postcode extraction)
- Direct codebase audit — `frontend/src/hooks/useReports.ts` — mutation hook pattern
- Direct codebase audit — `frontend/src/components/reports/SaveReportFlow.tsx` — toast progress pattern
- Direct codebase audit — `frontend/src/components/layout/InspectorPanel.tsx` — current parcel display
- Direct codebase audit — `frontend/src/components/results/ParcelDetailModal.tsx` — current modal with action pattern
- Direct codebase audit — `backend/app/government_apis/pdok_locatieserver.py` — `reverse()` returns `weergavenaam` string

### Secondary (MEDIUM confidence)
- Memory.md: `db.add()/db.flush()/db.commit()` pattern — confirmed by service.py code audit
- Memory.md: `datetime.utcnow()` (naive UTC) pattern — confirmed by multiple model files
- Prior decisions: "No new dependencies required" — confirmed by code audit

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in project
- Architecture: HIGH — all patterns confirmed by direct code reading
- Pitfalls: HIGH — based on actual code patterns and documented prior issues (MEMORY.md)
- Address parsing: MEDIUM — PDOK weergavenaam format is consistent but edge cases exist

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (stable — no external libraries changing)
