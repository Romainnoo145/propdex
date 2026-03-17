# S08: Asbestos V2 Refinement

**Goal:** Add BAG gebruiksdoel-aware asbestos risk to the existing bouwjaar-only NEN 2991 assessment.
**Demo:** Add BAG gebruiksdoel-aware asbestos risk to the existing bouwjaar-only NEN 2991 assessment.

## Must-Haves


## Tasks

- [x] **T01: 89-asbestos-v2-refinement 01** `est:2min`
  - Add BAG gebruiksdoel-aware asbestos risk to the existing bouwjaar-only NEN 2991 assessment.

Purpose: Industrial (fabriek/werkplaats) and educational (school) buildings used asbestos more extensively than residential. The current bouwjaar-only assessment misses this signal. Adding gebruiksdoel as an additive-only uplift gives developers better risk visibility.

Output: Updated `assess_asbest_risk()` with gebruiksdoel uplift, `AsbestIndicator.gebruiksdoel_factor` field, updated tests, updated frontend type.

## Files Likely Touched

- `backend/app/schemas/property.py`
- `backend/app/services/asbest_indicator.py`
- `backend/tests/unit/test_asbest_indicator.py`
- `frontend/src/lib/types/property.ts`
