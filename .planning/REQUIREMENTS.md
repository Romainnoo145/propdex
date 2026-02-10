# Requirements: Propdex v3.0 Area Intelligence

**Defined:** 2026-02-10
**Core Value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find unused building opportunities.

## v3.0 Requirements

### Area Scanning

- [ ] **SCAN-01**: User can select a gemeente on the map to initiate an area scan
- [ ] **SCAN-02**: System bulk-fetches all kadastrale percelen within the gemeente bounding box via PDOK
- [ ] **SCAN-03**: System cross-references parcels with BAG panden to identify parcels without buildings (has_pand = false)
- [ ] **SCAN-04**: System queries bestemming per parcel via DSO to identify "Wonen" zoning with bouwvlak
- [ ] **SCAN-05**: Area scans run as background jobs with progress polling (not blocking HTTP response)
- [ ] **SCAN-06**: Scan size is limited to max 10,000 parcels per scan with frontend validation

### Data Infrastructure

- [ ] **DATA-01**: PostGIS extension enabled with spatial query helpers (ST_Contains, ST_Intersects, ST_DWithin)
- [ ] **DATA-02**: Parcel cache table stores geometry (EPSG:28992) with GIST index for spatial joins
- [ ] **DATA-03**: Three-tier caching: lightweight pre-scan in DB (Tier 1), on-demand enrichment in JSONB (Tier 2), BRK never-stored (Tier 3)
- [ ] **DATA-04**: WFS pagination handles PDOK 1000-feature limit correctly (no silent truncation)
- [ ] **DATA-05**: Dubbele bestemming stored as JSONB array (parcels can have multiple overlapping zonings)
- [ ] **DATA-06**: All new tables have RLS policies matching existing multi-tenant patterns

### Government API Clients

- [ ] **API-01**: BAG WFS client fetches buildings in bbox with pagination (OGC API Features v2)
- [ ] **API-02**: SRU Bekendmakingen client queries vergunningen per parcel via Officiele Bekendmakingen
- [ ] **API-03**: Kadaster BRK Bevragen client fetches eigendomsdata for qualified leads (mTLS + API key)
- [ ] **API-04**: Per-API rate limiting with semaphore (max concurrent) + token bucket (requests/hour)
- [ ] **API-05**: Coordinate transformation at API boundary (EPSG:28992 storage, EPSG:4326 for GeoJSON responses)

### Map & Visualization

- [ ] **MAP-01**: CBS gemeente boundary polygons rendered as selectable layer on MapLibre map
- [ ] **MAP-02**: PDOK vector tiles replace WMS raster tiles for parcel boundaries (click/hover interaction)
- [ ] **MAP-03**: Martin tile server serves parcel_cache table as vector tile overlay with score-based color coding
- [ ] **MAP-04**: Scan progress visible on map (progress bar, phase indicators during background scan)

### Parcel List & Filtering

- [ ] **LIST-01**: Parcel list table with sort and filter (address, size, bestemming, has_pand, score)
- [ ] **LIST-02**: Server-side pagination for 2000+ row result sets (50 per page)
- [ ] **LIST-03**: CSV export of filtered parcels (address, size, bestemming, has_pand -- no owner info in CSV)
- [ ] **LIST-04**: Filter controls for bestemming type, has_pand status, minimum parcel size

### Detail Modal

- [ ] **DETAIL-01**: Click parcel in list or on map opens detail modal with AI-generated summary
- [ ] **DETAIL-02**: Expandable source cards per data topic (Kadaster, Bestemming, Vergunningen)
- [ ] **DETAIL-03**: Vergunningen data from SRU API displayed in source card with permit type, date, status
- [ ] **DETAIL-04**: BRK eigendomsdata available for qualified leads (behind legitimate interest confirmation)

## v3.1 Requirements (Deferred)

### Enhanced Scanning

- **SCAN-10**: AI opportunity scoring algorithm (bestemming match + years unused + permit inactivity + parcel size)
- **SCAN-11**: Saved area scans with re-run capability and freshness detection
- **SCAN-12**: Polygon draw tool for custom scan areas (power users)
- **SCAN-13**: Open Raadsinformatie integration for gemeenteraad decisions per parcel

### Monitoring

- **MON-01**: Vergunningen monitoring with daily background ARQ jobs
- **MON-02**: Email/in-app alerts when new vergunningen affect saved parcels
- **MON-03**: Wijk/buurt hierarchical selection within gemeente

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scan entire Netherlands | API cost explosion + database bloat (10M+ parcels) |
| Real-time permit polling | APIs update daily, not real-time -- unnecessary complexity |
| Auto-generate owner letters | GDPR liability, not core intelligence |
| AirDNA / rental analytics | Not core to development opportunity identification |
| Financial feasibility calculator | Requires separate market data integrations |
| 3D visualization | Different product category entirely |
| CRM integration | Validate scan workflow first, CRM is a future product phase |
| Linked Data Overheid SPARQL | Too complex for real-time queries, existing APIs suffice |
| Multi-gemeente batch scans | Start with single gemeente, expand in v3.1+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | Phase 21 | Pending |
| SCAN-02 | Phase 20 | Pending |
| SCAN-03 | Phase 20 | Pending |
| SCAN-04 | Phase 20 | Pending |
| SCAN-05 | Phase 20 | Pending |
| SCAN-06 | Phase 20 | Pending |
| DATA-01 | Phase 18 | Pending |
| DATA-02 | Phase 18 | Pending |
| DATA-03 | Phase 18 | Pending |
| DATA-04 | Phase 19 | Pending |
| DATA-05 | Phase 18 | Pending |
| DATA-06 | Phase 18 | Pending |
| API-01 | Phase 19 | Pending |
| API-02 | Phase 19 | Pending |
| API-03 | Phase 19 | Pending |
| API-04 | Phase 19 | Pending |
| API-05 | Phase 18 | Pending |
| MAP-01 | Phase 21 | Pending |
| MAP-02 | Phase 21 | Pending |
| MAP-03 | Phase 21 | Pending |
| MAP-04 | Phase 21 | Pending |
| LIST-01 | Phase 22 | Pending |
| LIST-02 | Phase 20 | Pending |
| LIST-03 | Phase 20 | Pending |
| LIST-04 | Phase 22 | Pending |
| DETAIL-01 | Phase 22 | Pending |
| DETAIL-02 | Phase 22 | Pending |
| DETAIL-03 | Phase 22 | Pending |
| DETAIL-04 | Phase 22 | Pending |

**Coverage:**
- v3.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after roadmap creation*
