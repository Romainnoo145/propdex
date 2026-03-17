# T02: 111.1-parcel-identity-unification 02

**Slice:** S13 — **Milestone:** M001

## Description

Backfill parcel_code for all existing parcel_cache rows via PDOK WFS batch lookup, then populate parcel_favorites.parcel_cache_id FK by joining on the now-shared display string.

Purpose: Without backfill, existing 137k rows have NULL parcel_code and the favorites FK is unpopulated. Portfolio queries that join favorites to geometry/address would return no data.

Output: CLI tool `python -m app.tools.backfill_parcel_code` that populates both columns, with progress logging and error handling.

## Must-Haves

- [ ] "All 137k parcel_cache rows with numeric identificatie have parcel_code populated"
- [ ] "parcel_favorites.parcel_cache_id FK is populated by joining on parcel_code = parcel_favorites.parcel_id"
- [ ] "Backfill tool handles non-numeric IDs gracefully (skip PDOK, leave NULL)"
- [ ] "PDOK WFS rate limits respected (semaphore concurrency, batch sleep)"

## Files

- `backend/app/tools/backfill_parcel_code.py`
