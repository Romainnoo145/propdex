# TODO: Bestemming-tile frontend parity met S04 count-voting

**Captured:** 2026-04-20 tijdens M046/S06 T07 verificatie
**Target milestone:** M048 Frontend Scaling (of apart slice)
**Impact:** UI-correctness, niet score-correctness

## Probleem

`frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx:48-66` implementeert
`deriveBestemmingCategory` met frontend-side substring-match op stringified bestemmingen.
Dit is "eerste match wint" ordering, geen count-voting.

Voor een perceel met `bestemmingen = [verkeer, verkeer-verblijfsgebied, wonen]`:
- Backend M046/S04 `_best_bestemming_type` zegt: "verkeer" (count 2-1)
- Frontend `deriveBestemmingCategory` zegt: "wonen" (scan valt door tot hasWonen=true)

De bestemming-tile in bento-grid (Card 2) toont daarmee "wonen" terwijl de score-
breakdown correct "verkeer" gebruikt. UI liegt over de primary bestemming — exact de
klasse bug die S04 wilde fixen, maar in een parallel UI-path.

## Oplossing

Twee opties:

**A. Frontend replica van backend-algoritme**
- Port `_best_bestemming_type` + priority-lijst naar TS helper (`frontend/src/lib/scoring/primaryBestemming.ts`)
- Vervang `deriveBestemmingCategory` door call naar nieuwe helper
- Risico: drift tussen python + ts implementaties

**B. Backend expose primary_bestemming_type in at-point response**
- Voeg `primary_bestemming_type: str` toe aan `GET /api/scans/parcels/at-point` response
- Backend berekent one-time via `_best_bestemming_type(parcel_data)` en stuurt door
- Frontend gebruikt veld direct ipv zelf te rekenen
- Single source of truth, geen drift

**Aanbeveling: B** (single source of truth, matcht M047/M048 richting van structured API contracts).

## Scope notes

- Niet in M046/S06 — S06 is zuiver UI voor missing-data signalen, niet voor bestemming-display-logic parity
- Kandidate voor M048 Frontend Scaling (zelfde richting: API-driven UI, minder frontend-side recompute)
- Alternatief: quick-fix slice na M046 als partial-tech-debt (1-2 uur werk optie B)

## Files touched

- `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx` (logic fix)
- `backend/app/api/endpoints/scans.py` of equivalent (response expand, optie B)
- `backend/app/services/score_v3_factors.py:51` (expose `_best_bestemming_type` public als nog niet)
