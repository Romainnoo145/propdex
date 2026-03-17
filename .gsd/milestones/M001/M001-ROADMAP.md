# M001: Migration

**Vision:** A property intelligence platform for Dutch projectontwikkelaars (real estate developers) who buy churches, monuments, land, and commercial buildings to redevelop into residential projects.

## Success Criteria


## Slices

- [x] **S01: Ruling Cache Ecli Mapping** `risk:medium` `depends:[]`
  > After this: Create the data foundation for v13.
- [x] **S02: Geo Contextualization Feed** `risk:medium` `depends:[S01]`
  > After this: Build the GeoContextualizer service that extracts gemeente names from ruling text, add extracted_gemeente and uitkomst columns to RulingCache via Alembic migration, and integrate geo-extraction into the ruling ingestion pipeline including RVS ruling support.
- [x] **S03: Ai Analysis Doorlooptijd** `risk:medium` `depends:[S02]`
  > After this: Add per-ruling AI analysis with vergunningstype classification, text section extraction for token budget control, and doorlooptijd (procedure duration) calculation to the backend.
- [x] **S04: Explorer Ui** `risk:medium` `depends:[S03]`
  > After this: Backend infrastructure for the Jurisprudentie Explorer: rechtsgronden AI classification, Alembic migration, faceted explorer endpoint with cross-filter counts, and offset pagination.
- [x] **S05: Trend Statistics** `risk:medium` `depends:[S04]`
  > After this: Add a trend endpoint that returns rolling 12-month klimaat score data and aggregated statistics per gemeente.
- [x] **S06: Soil Data Integration** `risk:medium` `depends:[S05]`
  > After this: Integrate BRO Bodemkaart WMS and PDOK Funderingsrisicogebieden WFS into the property aggregation pipeline, providing per-coordinate soil classification and postcode-level foundation risk area context with JSONB caching.
- [x] **S07: Foundation Risk Engine** `risk:medium` `depends:[S06]`
  > After this: Build the foundation risk engine: a pure-function heuristic that combines bouwjaar and bodemtype to produce foundation risk ratings, KCAF cost indications, and a combined Fysiek Risicoprofiel schema.
- [x] **S08: Asbestos V2 Refinement** `risk:medium` `depends:[S07]`
  > After this: Add BAG gebruiksdoel-aware asbestos risk to the existing bouwjaar-only NEN 2991 assessment.
- [x] **S09: Frontend Fysiek Risicoprofiel** `risk:medium` `depends:[S08]`
  > After this: Add a Fysiek Risicoprofiel section to ParcelDetailModal showing foundation risk, soil classification, asbestos exposure, and contamination data with amber confidence badges and indicatief disclaimers.
- [x] **S10: Backend Foundation** `risk:medium` `depends:[S09]`
  > After this: Create the ParcelFavorite SQLAlchemy model, Alembic migration with RLS, and Pydantic schemas for the favorites + portfolio API.
- [x] **S11: Projectlist Refactor Heartbutton** `risk:medium` `depends:[S10]`
  > After this: Extract the 1867-line ProjectList.
- [x] **S12: Portfolio Navigation** `risk:medium` `depends:[S11]`
  > After this: unit tests prove portfolio-navigation works
- [x] **S13: Parcel Identity Unification** `risk:medium` `depends:[S12]`
  > After this: Add parcel_code column to parcel_cache, parcel_cache_id FK to parcel_favorites, and populate parcel_code at scan time.
- [x] **S14: Pipeline Stages** `risk:medium` `depends:[S13]` ⛔ SKIPPED — superseded by M002/Phase 118
  > Skipped: Pipeline UI absorbed into M002 Opgeslagen view; Projecten page killed
- [x] **S15: Map Markers** `risk:medium` `depends:[S14]` ⛔ SKIPPED — carries forward to M002
  > Skipped: Favorite markers carry forward to M002 Kansenkaart milestone
