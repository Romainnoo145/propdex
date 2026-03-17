# T01: 88-foundation-risk-engine 01

**Slice:** S07 — **Milestone:** M001

## Description

Build the foundation risk engine: a pure-function heuristic that combines bouwjaar and bodemtype to produce foundation risk ratings, KCAF cost indications, and a combined Fysiek Risicoprofiel schema. Wire into property_aggregator.py as synchronous post-processing after asyncio.gather.

Purpose: FUND-01/FUND-02/FUND-03 — developers see foundation risk rating, combined physical risk profile, and indicative repair costs for any parcel, enabling go/no-go decisions before acquisition.

Output: foundation_risk_engine.py (pure functions), extended fysiek_risico.py schemas, PropertyReportResponse with fysiek_risico_profiel field, aggregator wiring.

## Must-Haves

- [ ] "User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype for any parcel"
- [ ] "User sees combined Fysiek Risicoprofiel summary aggregating foundation, soil, asbest, and contamination risks"
- [ ] "User sees KCAF reference cost range for foundation repair when risk is hoog or middel"
- [ ] "Foundation risk for post-1970 buildings is always LAAG regardless of soil type"
- [ ] "Missing soil data results in ONBEKEND risk, never LAAG"
- [ ] "KCAF cost indication always includes prominent disclaimer text"

## Files

- `backend/app/schemas/fysiek_risico.py`
- `backend/app/services/foundation_risk_engine.py`
- `backend/app/schemas/property.py`
- `backend/app/services/property_aggregator.py`
