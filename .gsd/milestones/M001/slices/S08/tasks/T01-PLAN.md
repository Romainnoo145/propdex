# T01: 89-asbestos-v2-refinement 01

**Slice:** S08 — **Milestone:** M001

## Description

Add BAG gebruiksdoel-aware asbestos risk to the existing bouwjaar-only NEN 2991 assessment.

Purpose: Industrial (fabriek/werkplaats) and educational (school) buildings used asbestos more extensively than residential. The current bouwjaar-only assessment misses this signal. Adding gebruiksdoel as an additive-only uplift gives developers better risk visibility.

Output: Updated `assess_asbest_risk()` with gebruiksdoel uplift, `AsbestIndicator.gebruiksdoel_factor` field, updated tests, updated frontend type.

## Must-Haves

- [ ] "Industrial building (industriefunctie) with bouwjaar 1980 shows risk=hoog with gebruiksdoel mentioned in explanation"
- [ ] "Post-1993 industrial building shows risk=middel (uplifted from geen) with gebruiksdoel_factor=industriefunctie"
- [ ] "Post-1993 residential building shows risk=geen (no uplift)"
- [ ] "Pre-1963 industrial building shows risk=middel (unchanged -- already at middel baseline, gebruiksdoel does not push to hoog)"
- [ ] "Building with unknown bouwjaar + industriefunctie shows risk=onbekend (no uplift on onbekend)"

## Files

- `backend/app/schemas/property.py`
- `backend/app/services/asbest_indicator.py`
- `backend/tests/unit/test_asbest_indicator.py`
- `frontend/src/lib/types/property.ts`
