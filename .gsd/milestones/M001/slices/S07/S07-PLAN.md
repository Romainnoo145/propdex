# S07: Foundation Risk Engine

**Goal:** Build the foundation risk engine: a pure-function heuristic that combines bouwjaar and bodemtype to produce foundation risk ratings, KCAF cost indications, and a combined Fysiek Risicoprofiel schema.
**Demo:** Build the foundation risk engine: a pure-function heuristic that combines bouwjaar and bodemtype to produce foundation risk ratings, KCAF cost indications, and a combined Fysiek Risicoprofiel schema.

## Must-Haves


## Tasks

- [x] **T01: 88-foundation-risk-engine 01** `est:5min`
  - Build the foundation risk engine: a pure-function heuristic that combines bouwjaar and bodemtype to produce foundation risk ratings, KCAF cost indications, and a combined Fysiek Risicoprofiel schema. Wire into property_aggregator.py as synchronous post-processing after asyncio.gather.

Purpose: FUND-01/FUND-02/FUND-03 — developers see foundation risk rating, combined physical risk profile, and indicative repair costs for any parcel, enabling go/no-go decisions before acquisition.

Output: foundation_risk_engine.py (pure functions), extended fysiek_risico.py schemas, PropertyReportResponse with fysiek_risico_profiel field, aggregator wiring.

## Files Likely Touched

- `backend/app/schemas/fysiek_risico.py`
- `backend/app/services/foundation_risk_engine.py`
- `backend/app/schemas/property.py`
- `backend/app/services/property_aggregator.py`
