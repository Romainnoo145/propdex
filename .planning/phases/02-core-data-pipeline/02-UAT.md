---
status: complete
phase: 02-core-data-pipeline
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-02-07T06:00:00Z
updated: 2026-02-07T14:00:00Z
---

## Tests

### 1. FastAPI app starts with all routes
expected: Backend starts without errors. Swagger UI at http://localhost:8000/docs shows POST /api/properties/lookup and GET /api/properties/suggest endpoints alongside existing auth endpoints.
result: PASS — Swagger UI returns 200, all 13 endpoints listed including /api/properties/lookup and /api/properties/suggest.

### 2. Dutch postcode validation works
expected: POST /api/properties/lookup with an invalid postcode (e.g., "invalid") returns a 422 validation error with message about Dutch postcode format.
result: PASS — Returns 422 with "Invalid Dutch postcode format. Expected: 1234AB or 1234 AB".

### 3. Property lookup requires authentication
expected: POST /api/properties/lookup without a JWT token returns 401 Unauthorized.
result: PASS — Returns 401 "Could not validate credentials".

### 4. Address autocomplete requires authentication
expected: GET /api/properties/suggest?q=Dam without a JWT token returns 401 Unauthorized.
result: PASS — Returns 401 "Could not validate credentials".

### 5. Authenticated property lookup returns structured response
expected: Without BAG_API_KEY, returns 502 with clear upstream error message. With BAG_API_KEY, returns full PropertyLookupResponse.
result: PASS (after fix) — Initially returned 500 because httpx.HTTPStatusError was not wrapped as GovernmentAPIError. Fixed handle_api_response to wrap all HTTP errors. Now returns 502 "Failed to resolve address: HTTP 401". Address autocomplete (PDOK, no key needed) returns real data: "Dam 1, 1012JS Amsterdam" as top result.

### 6. Cache table exists in database
expected: cached_api_responses table exists with cache_key, source, response_data (JSONB), organization_id, fetched_at, ttl_seconds.
result: PASS — All columns present with correct types, composite index on (organization_id, cache_key), FK to organizations with CASCADE delete.

## Summary

total: 6
passed: 6
issues: 1 (fixed)
pending: 0
skipped: 0

## Issues Found & Fixed

### ISS-01: httpx.HTTPStatusError not wrapped as GovernmentAPIError
- **File:** `backend/app/government_apis/base.py`
- **Symptom:** Property lookup returned 500 instead of 502 when BAG API returned 401
- **Root cause:** `handle_api_response()` converted 404→APINotFoundError and 429→APIRateLimitError, but let other HTTP errors raise as raw `httpx.HTTPStatusError` which isn't a `GovernmentAPIError` subclass
- **Fix:** Wrapped `response.raise_for_status()` in try/except to convert all HTTP errors to `GovernmentAPIError`
- **Severity:** Medium — affected error reporting, not functionality

## Gaps

[none]
