---
phase: 15
plan: 01
subsystem: frontend-data-layer
tags: [typescript, tanstack-query, api-client, authentication]
requires:
  - 14-05 (JWT auth with useAuth hook)
provides:
  - TypeScript types matching all backend property schemas
  - Authenticated API client with Bearer token injection
  - Debounced address suggest hook
  - Property lookup mutation hook with caching
affects:
  - 15-02 (Address search UI uses useAddressSuggest)
  - 15-03 (Property detail view uses usePropertyLookup)
  - 15-04 (Map integration uses PropertyReportResponse types)
  - 15-05 (All UI components depend on typed data layer)
tech-stack:
  added:
    - TanStack Query v5 hooks for address suggest and property lookup
  patterns:
    - Authenticated fetch wrapper with Bearer token
    - Debounced query with 300ms delay and 3+ char minimum
    - Mutation with automatic cache population by address ID
    - AbortSignal for query cancellation
key-files:
  created:
    - frontend/src/lib/types/property.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useAddressSuggest.ts
    - frontend/src/hooks/usePropertyLookup.ts
decisions:
  - decision: Use snake_case in TypeScript types to match backend JSON exactly
    rationale: Backend returns JSON with snake_case keys, no camelCase transformation
    impact: Type safety matches backend contracts precisely
  - decision: Use type alias instead of namespace for GeoJSONGeometry
    rationale: ESLint prefers ES2015 modules over namespaces
    impact: Cleaner code that passes linting without external GeoJSON dependency
  - decision: 300ms debounce with 3+ char minimum for address suggest
    rationale: Balance between responsive UX and API rate limits (60/minute)
    impact: Reduces API calls during typing while maintaining good UX
  - decision: Cache PropertyReportResponse by nummeraanduiding_id
    rationale: Allows instant loading if user navigates back to same address
    impact: Better UX, reduced API calls for repeated lookups
metrics:
  duration: 229s
  completed: 2026-02-08
---

# Phase 15 Plan 01: Frontend Data Layer Foundation Summary

**One-liner:** Authenticated API client with Bearer tokens, TypeScript types matching all backend schemas, TanStack Query hooks for debounced suggest and cached lookup

## Objective Achieved

Created the complete data layer foundation: TypeScript types matching ALL backend property schemas (PropertyReportResponse, ZoningData, MonumentStatus, AIParsingSection), an authenticated API client with Bearer token injection, and TanStack Query hooks for address suggest (300ms debounce, 3+ chars) and property lookup (mutation with cache).

## Tasks Completed

### Task 1: Create TypeScript types and authenticated API client

**Commit:** `2b62e48`

**What was built:**

1. **frontend/src/lib/types/property.ts** - Complete TypeScript type definitions:
   - `AddressInput` - Request schema for property lookup
   - `SuggestResult` - PDOK suggest API response with index signature
   - `BAGAddressResponse` - Structured address data from BAG
   - `BuildingData` - Building/pand details with geometry
   - `CadastralParcel` - Cadastral parcel data with geometry
   - `BuildingDimensions` - Zoning dimension constraints
   - `ZoningRule`, `ZoningPlan`, `ZoningData` - Complete zoning schema
   - `MonumentSourceResult`, `MonumentStatus` - Multi-source monument data
   - `MapData` - Map rendering with geometries
   - `DataSourceInfo`, `SectionSourceInfo` - Cache metadata and source attribution
   - `BuildingDimensionsAI`, `BestemmingsregelExtract`, `BestemmingsplanParsed` - AI parsing schemas
   - `AIParsingSection` - AI parsing status and data
   - `PropertyReportResponse` - Complete property report (core + Phase 3 + Phase 4)
   - All types use snake_case to match backend JSON exactly

2. **frontend/src/lib/api.ts** - Authenticated API client:
   - `apiFetch<T>` - Generic fetch wrapper with Bearer token injection
   - Accepts `accessToken` parameter from useAuth()
   - Sets `Authorization: Bearer {token}` header
   - Sets `credentials: 'include'` for httpOnly cookies
   - Parses error `detail` from backend responses
   - Supports `AbortSignal` for request cancellation
   - `suggestAddresses(query, accessToken, signal)` - GET /api/properties/suggest
   - `lookupProperty(input, accessToken)` - POST /api/properties/lookup

**Files created:**
- `frontend/src/lib/types/property.ts` (360 lines)
- `frontend/src/lib/api.ts` (115 lines)

**Verification:**
- ✅ TypeScript check passes (`npx tsc --noEmit`)
- ✅ All backend PropertyReportResponse fields represented
- ✅ API functions use Bearer token authentication
- ✅ Follows existing auth/api.ts pattern

### Task 2: Create TanStack Query hooks for suggest and lookup

**Commit:** `bc06102`

**What was built:**

1. **frontend/src/hooks/useAddressSuggest.ts** - Debounced address suggest:
   - Internal `debouncedQuery` state with 300ms delay
   - `useEffect` hook to update debounced query after timeout
   - Gets `accessToken` from `useAuth()`
   - TanStack Query with:
     - `queryKey: ['address-suggest', debouncedQuery]`
     - `queryFn` calls `suggestAddresses()` with AbortSignal
     - `enabled: debouncedQuery.length >= 3` (minimum 3 chars)
     - `staleTime: 30_000` (30 seconds - suggests don't change often)
   - Returns `UseQueryResult<SuggestResult[], Error>`

2. **frontend/src/hooks/usePropertyLookup.ts** - Property lookup mutation:
   - Gets `accessToken` from `useAuth()`
   - Gets `queryClient` from `useQueryClient()`
   - `useMutation` with:
     - `mutationFn` calls `lookupProperty(input, accessToken)`
     - `onSuccess` caches result: `queryClient.setQueryData(['property', data.address.nummeraanduiding_id], data)`
   - Returns `UseMutationResult<PropertyReportResponse, Error, AddressInput>`

**Files created:**
- `frontend/src/hooks/useAddressSuggest.ts` (47 lines)
- `frontend/src/hooks/usePropertyLookup.ts` (35 lines)

**Files modified:**
- `frontend/src/lib/types/property.ts` - Fixed namespace to type alias for ESLint

**Verification:**
- ✅ TypeScript check passes
- ✅ useAddressSuggest has 300ms debounce and 3-char minimum
- ✅ usePropertyLookup caches result by nummeraanduiding_id
- ✅ ESLint passes on all new files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ESLint namespace violation**

- **Found during:** Task 1 verification
- **Issue:** ESLint `@typescript-eslint/no-namespace` error on GeoJSON namespace
- **Fix:** Changed from `namespace GeoJSON { export type Geometry }` to `type GeoJSONGeometry`
- **Files modified:** `frontend/src/lib/types/property.ts`
- **Commit:** `bc06102` (Task 2 commit)
- **Rationale:** ESLint prefers ES2015 modules over namespaces. Using type alias achieves same goal without dependency.

## Success Criteria Met

- ✅ TypeScript types match all backend schemas (PropertyReportResponse, AddressInput, MapData, etc.)
- ✅ Authenticated API client (apiFetch) injects Bearer token on all requests
- ✅ suggestAddresses supports AbortSignal for TanStack Query cancellation
- ✅ useAddressSuggest debounces 300ms, enabled at 3+ chars, returns SuggestResult[]
- ✅ usePropertyLookup posts AddressInput, returns PropertyReportResponse, caches result
- ✅ TypeScript compilation passes with zero errors
- ✅ ESLint passes on all new files

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create TypeScript types and authenticated API client | `2b62e48` | property.ts, api.ts |
| 2 | Create TanStack Query hooks for suggest and lookup | `bc06102` | useAddressSuggest.ts, usePropertyLookup.ts, property.ts (fix) |

## Integration Points

**Provides to downstream plans:**

1. **15-02 (Address Search UI):**
   - `useAddressSuggest` hook for autocomplete
   - `AddressInput`, `SuggestResult` types

2. **15-03 (Property Detail View):**
   - `usePropertyLookup` hook for form submission
   - `PropertyReportResponse` type for rendering

3. **15-04 (Map Integration):**
   - `MapData`, `GeoJSONGeometry` types for map layers
   - `CadastralParcel`, `ZoningRule` geometry data

4. **15-05 (Full Integration):**
   - Complete type system for all property data
   - Authenticated API client pattern

**Dependencies from previous phases:**

1. **14-05 (JWT Authentication):**
   - `useAuth()` hook provides `accessToken`
   - AuthContext provides authentication state
   - httpOnly refresh cookies managed by auth system

## Technical Highlights

1. **Complete Type Coverage:** All 20+ backend Pydantic schemas mapped to TypeScript
2. **Type Safety:** snake_case types match backend JSON exactly (no transformation)
3. **Debounce Pattern:** 300ms delay + 3 char minimum balances UX and rate limits
4. **Cache Strategy:** Mutations populate query cache for instant navigation
5. **Cancellation:** AbortSignal integration for automatic cleanup
6. **Auth Integration:** Bearer token injection on every request

## Next Phase Readiness

**Ready to implement:**
- ✅ Address search UI can import useAddressSuggest
- ✅ Property lookup form can import usePropertyLookup
- ✅ Map components can import MapData and geometry types
- ✅ All UI components have typed API contracts

**Blockers:** None

**Concerns:** None

**Notes:**
- Types use snake_case - remind UI developers NOT to transform keys
- Suggest hook has 60/minute rate limit on backend (frontend debounce helps)
- Lookup hook has 30/minute rate limit (consider rate limit UI feedback in 15-03)

## Self-Check: PASSED

All created files exist:
- ✅ frontend/src/lib/types/property.ts
- ✅ frontend/src/lib/api.ts
- ✅ frontend/src/hooks/useAddressSuggest.ts
- ✅ frontend/src/hooks/usePropertyLookup.ts

All commits exist:
- ✅ 2b62e48 (Task 1)
- ✅ bc06102 (Task 2)
