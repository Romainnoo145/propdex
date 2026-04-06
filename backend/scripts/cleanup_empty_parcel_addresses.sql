-- M035-S02: Clean up addresses incorrectly assigned to empty parcels
-- The turbo backfill script resolved addresses for all parcels regardless of has_pand.
-- Empty parcels (has_pand = false) should have address = NULL.
--
-- Verification: SELECT count(*) FROM parcel_cache WHERE has_pand = false AND address IS NOT NULL;
-- Expected: 0 after running this script.

BEGIN;

-- Count affected rows before cleanup
SELECT count(*) AS affected_rows
FROM parcel_cache
WHERE has_pand = false AND address IS NOT NULL;

-- NULL out addresses on empty parcels
UPDATE parcel_cache
SET address = NULL
WHERE has_pand = false AND address IS NOT NULL;

COMMIT;
