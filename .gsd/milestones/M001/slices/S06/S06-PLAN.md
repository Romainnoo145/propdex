# S06: Soil Data Integration

**Goal:** Integrate BRO Bodemkaart WMS and PDOK Funderingsrisicogebieden WFS into the property aggregation pipeline, providing per-coordinate soil classification and postcode-level foundation risk area context with JSONB caching.
**Demo:** Integrate BRO Bodemkaart WMS and PDOK Funderingsrisicogebieden WFS into the property aggregation pipeline, providing per-coordinate soil classification and postcode-level foundation risk area context with JSONB caching.

## Must-Haves


## Tasks

- [x] **T01: 87-soil-data-integration 01** `est:4min`
  - Integrate BRO Bodemkaart WMS and PDOK Funderingsrisicogebieden WFS into the property aggregation pipeline, providing per-coordinate soil classification and postcode-level foundation risk area context with JSONB caching.

Purpose: Enable Phase 88 (Foundation Risk Engine) to combine soil type with building age for risk assessment, and give users immediate soil/area context in parcel details.
Output: Two new government API clients, two aggregators with JSONB caching, Pydantic schemas, soil classifier, and PropertyReportResponse integration.

## Files Likely Touched

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
