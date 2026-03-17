# T01: 87-soil-data-integration 01

**Slice:** S06 — **Milestone:** M001

## Description

Integrate BRO Bodemkaart WMS and PDOK Funderingsrisicogebieden WFS into the property aggregation pipeline, providing per-coordinate soil classification and postcode-level foundation risk area context with JSONB caching.

Purpose: Enable Phase 88 (Foundation Risk Engine) to combine soil type with building age for risk assessment, and give users immediate soil/area context in parcel details.
Output: Two new government API clients, two aggregators with JSONB caching, Pydantic schemas, soil classifier, and PropertyReportResponse integration.

## Must-Haves

- [ ] "BRO Bodemkaart WMS returns soil type (klei/veen/zand/leem/onbekend) for any RD coordinate"
- [ ] "PDOK Funderingsrisicogebieden WFS returns postcode-level context (percvoor1970, fgr, legenda) for any pc6"
- [ ] "Soil data is cached in JSONB with 365-day TTL"
- [ ] "Funderingsrisico data is cached in JSONB with 180-day TTL"
- [ ] "Coordinates with no BRO coverage return onbekend, never an error"
- [ ] "Postcodes with no funderingsrisico data return None, never an error"
- [ ] "PropertyReportResponse includes soil_profile and funderingsrisicogebied fields"

## Files

- `backend/app/government_apis/bro_bodemkaart.py`
- `backend/app/government_apis/pdok_funderingsrisico.py`
- `backend/app/government_apis/rate_limiter.py`
- `backend/app/schemas/fysiek_risico.py`
- `backend/app/services/soil_classifier.py`
- `backend/app/services/soil_aggregator.py`
- `backend/app/services/funderingsrisico_aggregator.py`
- `backend/app/core/config.py`
- `backend/app/services/property_aggregator.py`
- `backend/app/schemas/property.py`
