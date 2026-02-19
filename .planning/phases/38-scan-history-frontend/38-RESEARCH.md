# Phase 38: Scan History Frontend - Research

**Researched:** 2026-02-19
**Domain:** TanStack Query v5, TanStack Router v1, React 19, TypeScript
**Confidence:** HIGH

## Summary

Phase 38 replaces demo data in `ProjectList.tsx` with real scan history fetched from the two
Phase 37 backend endpoints (`GET /api/scans` and `GET /api/projects/{id}/scans`). It also wires
up row action buttons to navigate to `/resultaten?scan_id=X` and `/map?scan_id=X`. No new
routes, no new backend calls beyond what Phase 37 delivered, and no new npm dependencies needed.

The work is contained in three existing files: `frontend/src/lib/api.ts` (add two fetch functions),
`frontend/src/hooks/useScans.ts` (add two Query hooks), and
`frontend/src/components/projects/ProjectList.tsx` (replace `DEMO_REPORTS` with real scan rows).
The navigation targets (`/resultaten` and `/map`) already accept `?scan_id=` search params and
handle them correctly — this is confirmed by reading `resultaten.tsx` and `map.tsx`.

The "Projecten" view currently displays scan children inside monitoring-project wijk rows as
`DEMO_REPORTS` items (reports). Phase 38 replaces those with real `ScanListItem` rows. The key
design decision is that scan history items are a completely different shape from `ReportListItem` —
they have `gemeente_naam`, `wijk_naam`, `parcel_count`, and `scan_date`, but no `report_name`
or `completeness_score`. A dedicated `ScanHistoryRow` component will render scan items inside
the existing expandable wijk section.

**Primary recommendation:** Add `fetchScanHistory` + `fetchProjectScans` to `api.ts`, create
`useScanHistory` + `useProjectScans` hooks in `useScans.ts`, add a `ScanListItem` TypeScript
interface to `scan.ts`, then update `ProjectList.tsx` to replace demo report rendering with
real scan rendering inside the wijk expanded section.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.90.20 | Server state, caching, loading/error states | Already used for all API calls in this codebase |
| @tanstack/react-router | ^1.158.4 | `useNavigate` for `/resultaten?scan_id=X` and `/map?scan_id=X` | Already used in `ProjectList.tsx` |
| React 19 | ^19.2.0 | Component rendering, `useState` | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/api.ts` apiFetch | n/a | Authenticated fetch wrapper | All backend calls |
| `@/lib/auth/useAuth` | n/a | `accessToken` for authenticated requests | All hooks in this codebase |
| `@/components/feedback/Skeleton` | n/a | Loading skeleton during query | Already used in ProjectList skeleton section |
| `@/components/feedback/EmptyState` | n/a | Empty state when no scans | Already used in `/resultaten` |
| Intl.DateTimeFormat nl-NL | browser | Dutch date formatting | Already used in ProjectList for `dateFmt` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-project `useProjectScans` hook | Single `useScanHistory` filtered client-side | Per-project is more correct — avoids loading all scans just to filter; backend already supports `GET /api/projects/{id}/scans` |
| Rendering scans inside existing report section | New `ScanHistoryRow` sub-component | Dedicated component is cleaner — scan shape is different from `ReportListItem` |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Changes

No new files. Changes go into existing files:

```
frontend/src/
├── lib/
│   ├── api.ts             # Add fetchScanHistory() + fetchProjectScans()
│   └── types/scan.ts      # Add ScanListItem + ScanListResponse interfaces
├── hooks/
│   └── useScans.ts        # Add useScanHistory() + useProjectScans()
└── components/projects/
    └── ProjectList.tsx    # Replace DEMO_REPORTS with real scan data + row actions
```

### Pattern 1: API Fetch Functions

Follow exactly the same shape as `fetchScanResults` in `api.ts`:

```typescript
// Source: frontend/src/lib/api.ts — fetchScanResults pattern (line 575-601)

/**
 * Fetch paginated scan history for the authenticated organization
 *
 * GET /api/scans
 */
export async function fetchScanHistory(
  accessToken: string | null,
  params?: { offset?: number; limit?: number; status?: string }
): Promise<ScanListResponse> {
  const query = new URLSearchParams()
  if (params?.offset !== undefined) query.set('offset', params.offset.toString())
  if (params?.limit !== undefined) query.set('limit', params.limit.toString())
  if (params?.status) query.set('status', params.status)

  const url = `${SCANS_BASE}${query.toString() ? `?${query}` : ''}`
  return apiFetch<ScanListResponse>(url, { method: 'GET', accessToken })
}

/**
 * Fetch paginated scans for a specific project
 *
 * GET /api/projects/{projectId}/scans
 */
export async function fetchProjectScans(
  projectId: string,
  accessToken: string | null,
  params?: { offset?: number; limit?: number }
): Promise<ScanListResponse> {
  const query = new URLSearchParams()
  if (params?.offset !== undefined) query.set('offset', params.offset.toString())
  if (params?.limit !== undefined) query.set('limit', params.limit.toString())

  const url = `${PROJECTS_BASE}/${projectId}/scans${query.toString() ? `?${query}` : ''}`
  return apiFetch<ScanListResponse>(url, { method: 'GET', accessToken })
}
```

### Pattern 2: TanStack Query Hooks

Follow exactly the same pattern as `useScanResults` in `useScans.ts`:

```typescript
// Source: frontend/src/hooks/useScans.ts — useScanResults pattern (lines 115-127)

/**
 * Fetch paginated scan history
 *
 * Query key: ['scan-history']
 * Stale time: 5 minutes (scans are created via mutation, not background polling)
 */
export function useScanHistory(params?: { offset?: number; limit?: number; status?: string }) {
  const { accessToken } = useAuth()

  return useQuery<ScanListResponse, Error>({
    queryKey: ['scan-history', params],
    queryFn: () => fetchScanHistory(accessToken, params),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Fetch scans for a specific project
 *
 * Query key: ['project-scans', projectId]
 * Stale time: 5 minutes
 * Disabled when projectId is null
 */
export function useProjectScans(
  projectId: string | null,
  params?: { offset?: number; limit?: number }
) {
  const { accessToken } = useAuth()

  return useQuery<ScanListResponse, Error>({
    queryKey: ['project-scans', projectId, params],
    queryFn: () => fetchProjectScans(projectId!, accessToken, params),
    enabled: !!accessToken && !!projectId,
    staleTime: 5 * 60 * 1000,
  })
}
```

### Pattern 3: TypeScript Types for Backend Schemas

Add to `frontend/src/lib/types/scan.ts` (at the end, matching the backend `ScanListItem` schema
in `backend/app/scans/schemas.py`):

```typescript
// Source: backend/app/scans/schemas.py ScanListItem + ScanListResponse (lines 222-241)

/**
 * Schema for a single scan in the history list
 * Backend: ScanListItem
 */
export interface ScanListItem {
  /** AreaScan UUID (serialized as string) */
  scan_id: string
  /** Gemeente display name */
  gemeente_naam: string
  /** CBS gemeentecode */
  gemeente_code: string
  /** CBS wijk name (null for full-gemeente scans) */
  wijk_naam: string | null
  /** Scan creation timestamp (ISO 8601 string) */
  scan_date: string
  /** Scan status: pending | running | completed | failed | cancelled */
  status: string
  /** Number of qualifying scan results (COUNT of scan_results rows) */
  parcel_count: number
  /** Linked project folder ID (null for unassigned scans) */
  project_id: string | null
}

/**
 * Response schema for paginated scan history list
 * Backend: ScanListResponse
 */
export interface ScanListResponse {
  /** Paginated scan items */
  scans: ScanListItem[]
  /** Total scans matching filters (before pagination) */
  total: number
  /** Current offset */
  offset: number
  /** Page size */
  limit: number
}
```

### Pattern 4: Navigation in ProjectList.tsx

Follow the exact same `useNavigate` pattern already in `ProjectList.tsx` for `handleReportClick`:

```typescript
// Source: frontend/src/components/projects/ProjectList.tsx lines 135-144

// Existing report navigation pattern:
const handleReportClick = (report: ReportListItem) => {
  navigate({ to: '/rapport/$id', params: { id: report.id }, ... })
}

// New scan navigation patterns:
const handleScanResultsClick = (scan: ScanListItem) => {
  navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
}

const handleScanMapClick = (scan: ScanListItem) => {
  navigate({ to: '/map', search: { scan_id: scan.scan_id } })
}
```

Both `/resultaten` and `/map` already validate `scan_id` in their `validateSearch` — confirmed
by reading `resultaten.tsx` line 28 and `map.tsx` line 72.

### Pattern 5: Scan Row Rendering inside Wijk Expanded Section

The wijk section currently shows `DEMO_REPORTS` items. Replace with real scan items.
Each scan row should show: gemeente + wijk name, date, parcel count, plus two action buttons.

```tsx
// Replaces the DEMO_REPORTS section inside isWijkExpanded
{scans.map((scan) => (
  <div key={scan.scan_id} className="flex w-full items-center gap-3 border-b border-gray-100 px-10 py-3 last:border-b-0">
    {/* Scan icon */}
    <ScanIcon />
    {/* Metadata */}
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-800">
        {scan.gemeente_naam}{scan.wijk_naam ? ` — ${scan.wijk_naam}` : ''}
      </p>
      <p className="text-xs text-gray-400">
        {dateFmt.format(new Date(scan.scan_date))} · {scan.parcel_count} percelen
      </p>
    </div>
    {/* Action buttons */}
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => handleScanResultsClick(scan)} ...>Toon resultaten</button>
      <button onClick={() => handleScanMapClick(scan)} ...>Toon kaart</button>
    </div>
  </div>
))}
```

### Pattern 6: Empty State

Use the existing `EmptyState` component for the no-scans case:

```tsx
// Source: frontend/src/components/feedback/EmptyState.tsx
// Already used in resultaten.tsx lines 180-188

{scans.length === 0 && (
  <div className="border-t border-gray-100 px-10 py-4 text-center text-sm text-gray-400">
    Nog geen scans voor dit project
  </div>
)}
```

For the full projecten view with no scans at all (SCAN-04 empty state), this is already handled
by the existing empty project state at ProjectList.tsx line 427-436. The scan-specific empty state
is inside the wijk expanded section only.

### Anti-Patterns to Avoid

- **Removing DEMO_PROJECTS:** Keep `DEMO_PROJECTS` intact — it exists to show a placeholder UI
  when the backend is unavailable (`isDemo = !data && !isLoading`). Only remove `DEMO_REPORTS`.
- **Fetching all scans then filtering client-side:** Use `useProjectScans(projectId)` per wijk,
  not `useScanHistory` with client-side project filter — this avoids loading all org scans when
  the Projecten view expands a single wijk.
- **Fetching on every render:** `useProjectScans` is disabled when `projectId` is null —
  queries only fire when a wijk row is expanded. No need to preload.
- **Eager loading for all expanded wijks:** Only fetch scans for the currently expanded wijk. The
  `enabled: !!projectId` guard combined with the expand/collapse toggle handles this naturally.
- **Using `parcels_total` in display:** The backend returns `parcel_count` (COUNT of scan_results,
  the qualifying parcels). Display this, not `parcels_total` (which lives only on `ScanStatusResponse`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Caching scan list per project | Manual Map/state | TanStack Query with `['project-scans', projectId]` key | Automatic invalidation, deduplication, background refresh |
| Loading state skeleton | Custom spinner | `Skeleton` from `@/components/feedback/Skeleton` | Already styled to match the rest of the UI |
| Date formatting | Custom format function | `Intl.DateTimeFormat('nl-NL', ...)` | Already used in `ProjectList.tsx` as `dateFmt` |
| Authenticated fetch | Raw `fetch` with manual headers | `apiFetch` from `@/lib/api` | Handles Bearer token, credential cookies, error parsing |
| Navigation to /resultaten | `window.location.href` | `useNavigate` from TanStack Router | Type-safe, search param validation, SPA navigation |

**Key insight:** This phase is almost entirely wiring — connecting the already-defined backend API
to the already-defined frontend components. The hardest part is understanding where DEMO_REPORTS
is used (two places in the component: monitoring wijk section and regular project section) and
replacing both with the real data rendering correctly.

## Common Pitfalls

### Pitfall 1: DEMO_REPORTS Used in Two Sections
**What goes wrong:** `DEMO_REPORTS` appears in two code paths in `ProjectList.tsx`: once for
monitoring/wijk projects (lines 233-234) and once for regular projects (lines 321-322). Both
must be updated independently.
**Why it happens:** The component separates monitoring projects (gemeente > wijk hierarchy) from
regular projects (flat). The demo data shortcut is copy-pasted into both branches.
**How to avoid:** Replace BOTH occurrences. The regular project section also has a TODO comment
(`// TODO: fetch from useReports({ project_id }) when live`) — this TODO should be replaced with
the real scan hook call.
**Warning signs:** Only monitoring wijk shows real scans but regular projects still show empty.

### Pitfall 2: ScanListItem vs ReportListItem Shape Confusion
**What goes wrong:** The existing render code for reports uses `report.report_name`,
`report.completeness_score`, `report.notes`. Scan items have `scan.gemeente_naam`,
`scan.parcel_count`, `scan.wijk_naam` — completely different fields.
**Why it happens:** Copy-paste from the report rendering pattern without updating field names.
**How to avoid:** Write a separate `ScanHistoryRow` sub-component (or inline JSX with explicitly
named scan fields). Do not reuse the report JSX block.
**Warning signs:** TypeScript errors on `scan.report_name` (field doesn't exist on `ScanListItem`).

### Pitfall 3: useProjectScans Called with isDemo=true
**What goes wrong:** When `isDemo=true` (backend unavailable), API calls will fail. The hooks
must be disabled during demo mode, or the component must not render scan rows at all.
**Why it happens:** The `isDemo` flag exists precisely to guard against backend calls, but the
scan hooks don't know about it.
**How to avoid:** Pass `enabled: !isDemo && !!accessToken && !!projectId` to `useProjectScans`,
or conditionally render the scan section only when `!isDemo`. The existing pattern for
`ChangeTimeline` (line 305) uses `!isDemo && <ChangeTimeline />` as a guard.
**Warning signs:** Network errors in the browser console when viewing demo mode.

### Pitfall 4: Query Key Collision with Existing 'scan-status' Keys
**What goes wrong:** Existing hooks use query keys `['scan-status', scanId]` and
`['scan-results', scanId, filters]`. The new keys `['scan-history', params]` and
`['project-scans', projectId, params]` are distinct and safe — but must not accidentally
match existing keys during invalidation.
**Why it happens:** `queryClient.invalidateQueries({ queryKey: ['scan-...'] })` would
match any key starting with `scan-` if the prefix were the same.
**How to avoid:** Use `'scan-history'` (not `'scan'` or `'scans'`) as the root key. The
existing keys use `'scan-status'` and `'scan-results'` — no collision.

### Pitfall 5: Fetching Before Wijk is Expanded
**What goes wrong:** If `useProjectScans(projectId)` is called for ALL wijk projects in the
list, not just the expanded one, it fires N network requests on page load.
**Why it happens:** Hook called unconditionally inside the `.map()` over wijkChildren.
**How to avoid:** Call `useProjectScans` only when `isWijkExpanded` is true, OR rely on the
`enabled: !!projectId` guard but check if the wijk data is actually needed. The simplest approach:
create a `WijkScanList` sub-component that contains the hook — it only renders when expanded,
so the hook only fires when expanded.

### Pitfall 6: staleTime for Scan History
**What goes wrong:** Scan history is stale quickly if the user just ran a new scan and navigates
to Projecten — they'd see the old list.
**Why it happens:** Default staleTime from `queryClient.ts` is 5 minutes; a just-completed scan
wouldn't appear.
**How to avoid:** After a new scan completes (in `useScans.ts` `useTriggerScan` mutation), add
`queryClient.invalidateQueries({ queryKey: ['scan-history'] })` and
`queryClient.invalidateQueries({ queryKey: ['project-scans'] })` in `onSuccess`. Alternatively,
keep staleTime at 2 minutes for scan history hooks specifically. The phase plan for 38-01 says
to add these hooks — the invalidation belongs in `useTriggerScan`'s `onSuccess`.

## Code Examples

Verified patterns from existing frontend code:

### Existing Navigation Pattern (from ProjectList.tsx)
```typescript
// Source: frontend/src/components/projects/ProjectList.tsx lines 135-144
const handleReportClick = (report: ReportListItem) => {
  const streetPart = report.report_name.split(',')[0] ?? ''
  const hn = streetPart.match(/\d+/)?.[0] ?? '1'
  navigate({
    to: '/rapport/$id',
    params: { id: report.id },
    search: { postcode: report.postcode, huisnummer: parseInt(hn, 10) },
  })
}
```

### Validated scan_id in /resultaten Route
```typescript
// Source: frontend/src/routes/_authenticated/resultaten.tsx lines 27-49
validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
  scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
  // ...
})
```

### Validated scan_id in /map Route
```typescript
// Source: frontend/src/routes/_authenticated/map.tsx lines 65-73
validateSearch: (search: Record<string, unknown>): MapSearchParams => ({
  // ...
  scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
})
```

### ChangeTimeline Conditional Render (isDemo guard)
```tsx
// Source: frontend/src/components/projects/ProjectList.tsx line 305
{!isDemo && <ChangeTimeline projectId={wijk.id} />}
```

### Skeleton Loading Pattern (from ProjectList.tsx)
```tsx
// Source: frontend/src/components/projects/ProjectList.tsx lines 146-156
if (isLoading) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-grey-800 bg-grey-900 p-4 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
```

### Date Formatting (nl-NL locale, from ProjectList.tsx)
```typescript
// Source: frontend/src/components/projects/ProjectList.tsx lines 85-88
const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
})
// Usage: dateFmt.format(new Date(scan.scan_date))
```

### apiFetch pattern (from api.ts)
```typescript
// Source: frontend/src/lib/api.ts lines 56-89
return apiFetch<ScanListResponse>(url, { method: 'GET', accessToken })
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| DEMO_REPORTS hardcoded in ProjectList.tsx | Real `ScanListItem[]` from `GET /api/projects/{id}/scans` | Phase 38 delivers this change |
| Empty TODO comment for live data | `useProjectScans` hook with TanStack Query | Phase 38 delivers this |
| Report rows (report_name, score %) | Scan rows (gemeente, wijk, date, parcel count) | Different data shape — scan rows need their own JSX |

**Deprecated in this phase:**
- `DEMO_REPORTS` constant and its `Record<string, ReportListItem[]>` type — remove after replacing with real data
- The TODO comment `// TODO: fetch from useReports({ project_id }) when live` in both sections

## Open Questions

1. **Should scans appear under ALL project types, or only monitoring projects?**
   - What we know: Phase 37 created `GET /api/projects/{id}/scans` (sub-resource) and
     `GET /api/scans` (all scans for org). Scans have `project_id` (nullable — null for unassigned).
   - What's unclear: Regular projects (non-monitoring) can also have associated scans if the user
     scanned a wijk and the project was auto-created.
   - Recommendation: Render scan history in BOTH monitoring wijk sections AND regular project
     sections. Use `useProjectScans(project.id)` in both cases. A project with no linked scans
     shows "Nog geen scans voor dit project."

2. **What to show for scans with status != 'completed'?**
   - What we know: Backend returns ALL statuses; a running/failed scan may appear in history.
   - What's unclear: Should failed scans show action buttons? Should pending scans link anywhere?
   - Recommendation: Show status badge on the row. Disable "Toon resultaten" and "Toon kaart"
     buttons when `scan.status !== 'completed'`. Failed scans show status but no actions.

3. **Does `useTriggerScan` need cache invalidation for scan history?**
   - What we know: After a new scan completes, the user navigates to `/resultaten`. If they then
     navigate to `/projecten`, the scan history cache may be stale (5 min).
   - What's unclear: Whether stale-while-revalidate is acceptable for UX here.
   - Recommendation: Add `queryClient.invalidateQueries({ queryKey: ['scan-history'] })` and
     `queryClient.invalidateQueries({ queryKey: ['project-scans'] })` in `useTriggerScan`'s
     `onSuccess`. This is low-cost and ensures the Projecten view always shows fresh data.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/projects/ProjectList.tsx` — existing demo data structure, navigation patterns, expand/collapse logic, isDemo guard, Skeleton usage, date format
- `frontend/src/hooks/useScans.ts` — hook patterns for `useQuery`, query key conventions, staleTime settings, `enabled` guard pattern
- `frontend/src/lib/api.ts` — `apiFetch` wrapper, `SCANS_BASE`, `PROJECTS_BASE`, existing scan fetch functions
- `frontend/src/lib/types/scan.ts` — existing scan TypeScript interfaces; confirmed no `ScanListItem` yet (needs adding)
- `frontend/src/routes/_authenticated/resultaten.tsx` — confirmed `scan_id` validated in `validateSearch`; confirmed navigation `navigate({ to: '/resultaten', search: { scan_id } })` works
- `frontend/src/routes/_authenticated/map.tsx` — confirmed `scan_id` validated in `validateSearch`; confirmed `urlScanId` sets `activeScanId` on mount
- `backend/app/scans/schemas.py` — `ScanListItem` (lines 222-232) and `ScanListResponse` (lines 235-241) confirmed present and correct after Phase 37
- `frontend/src/components/feedback/EmptyState.tsx` — component interface confirmed
- `frontend/src/components/feedback/Skeleton.tsx` — component interface confirmed
- `.planning/phases/37-scan-history-backend/37-VERIFICATION.md` — Phase 37 fully verified (9/9 truths); endpoints confirmed working

### Secondary (MEDIUM confidence)
- `frontend/src/lib/queryClient.ts` — default staleTime (5 minutes); scan history hooks should follow this default
- `frontend/src/hooks/useNotifications.ts` — ChangeTimeline hook pattern as reference for project-scoped data fetching
- `frontend/src/components/notifications/ChangeTimeline.tsx` — pattern for fetching child data per project row (fires when expanded, guarded by `!isDemo`)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies, exact versions confirmed
- Architecture: HIGH — directly mirrors existing patterns in the same files; both route targets confirmed to accept `scan_id` search param
- Pitfalls: HIGH — DEMO_REPORTS dual usage confirmed by reading the component; isDemo guard pattern confirmed by ChangeTimeline usage

**Research date:** 2026-02-19
**Valid until:** 2026-03-20 (stable codebase; Phase 37 backend is frozen; no fast-moving deps)
