# Requirements: Propdex

**Core Value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities.

## v3.0 Requirements (Infrastructure — Shipped)

v3.0 built the spatial foundation, API clients, scan pipeline, and map visualization.
These are now validated infrastructure for v3.1.

### Validated (Shipped in v3.0 Phases 18-21)

- [x] **DATA-01**: PostGIS extension enabled with spatial query helpers (ST_Contains, ST_Intersects, ST_DWithin)
- [x] **DATA-02**: Parcel cache table stores geometry (EPSG:28992) with GIST index for spatial joins
- [x] **DATA-03**: Three-tier caching: lightweight pre-scan in DB (Tier 1), on-demand enrichment in JSONB (Tier 2), BRK never-stored (Tier 3)
- [x] **DATA-04**: WFS pagination handles PDOK 1000-feature limit correctly (no silent truncation)
- [x] **DATA-05**: Dubbele bestemming stored as JSONB array (parcels can have multiple overlapping zonings)
- [x] **DATA-06**: All new tables have RLS policies matching existing multi-tenant patterns
- [x] **API-01**: BAG WFS client fetches buildings in bbox with pagination
- [x] **API-02**: SRU Bekendmakingen client queries vergunningen via Officiele Bekendmakingen
- [x] **API-03**: Kadaster BRK Bevragen client (mTLS + API key, graceful disable in dev)
- [x] **API-04**: Per-API rate limiting with semaphore (max concurrent) + token bucket (requests/hour)
- [x] **API-05**: Coordinate transformation at API boundary (EPSG:28992 storage, EPSG:4326 for GeoJSON)
- [x] **SCAN-05**: Area scans run as background jobs with progress polling (ARQ worker)
- [x] **MAP-01**: CBS gemeente boundary polygons rendered as selectable layer on MapLibre map
- [x] **MAP-04**: Scan progress visible on map (progress bar, phase indicators during background scan)

---

## v3.1 Requirements (Smart Area Intelligence)

**Defined:** 2026-02-11
**Milestone Goal:** Transform the area scan from "fetch all buildings" into a bestemmingsplan-first workflow with focused deep-dives and change monitoring.

### Bestemmingsplan Visualization

- [ ] **ZONE-01**: User can toggle a bestemmingsplan layer on the map showing colored zoning areas (wonen, bedrijven, agrarisch, etc.) per SVBP2012 standard
- [ ] **ZONE-02**: User can click a zoning area to see plan name, bestemming type (hoofdgroep), and link to official document
- [ ] **ZONE-03**: User can toggle between bestemmingsplan layer, aerial imagery, and kadaster parcels simultaneously

### Area Deep-Dive

- [ ] **DIVE-01**: User can click on a bestemmingsplan zone or gemeente boundary on the map to select a scan area
- [ ] **DIVE-02**: User can trigger a focused BAG scan on the selected area (hundreds of parcels, not full gemeente)
- [ ] **DIVE-03**: User sees scan progress with phase indicator and percentage during area deep-dive
- [ ] **DIVE-04**: Scan results include bestemmingsplan hoofdgroep per parcel from zoning context

### Opportunity Scoring

- [ ] **SCORE-01**: Opportunity score factors in bestemmingsplan type (wonen = high for residential developers)
- [ ] **SCORE-02**: Scan results are colored on the map by score (green/yellow/red gradient)

### Parcel List & Detail

- [ ] **LIST-01**: User can view scan results in a sortable, filterable table (address, size, zone type, score)
- [ ] **LIST-02**: User can filter results by bestemmingsplan type, has_pand status, and minimum score
- [ ] **LIST-03**: User can click a parcel in list or on map to see detail modal with expandable source cards

### Change Monitoring

- [ ] **MON-01**: System checks daily for new omgevingsvergunningen in user's watched gemeentes via SRU
- [ ] **MON-02**: System checks daily for bestemmingsplan changes in watched gemeentes
- [ ] **MON-03**: User sees in-app notification badges for new changes since last visit
- [ ] **MON-04**: User can save scan areas for ongoing monitoring

## Future Requirements (post v3.1)

- **DETAIL-04**: BRK eigendomsdata for qualified leads (behind legitimate interest confirmation) — requires paid API access
- **MON-05**: Email digest for weekly monitoring summaries
- **MON-06**: Wijk/buurt hierarchical selection within gemeente
- **SCAN-13**: Open Raadsinformatie integration for gemeenteraad decisions
- **LIST-04**: Excel export of filtered scan results

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scan entire Netherlands | API cost explosion + database bloat (10M+ parcels) |
| Real-time permit webhooks | No gemeente offers webhooks, daily polling is correct |
| Auto-generate owner letters | GDPR liability, not core intelligence |
| 3D visualization | Different product category (3D Cityplanner) |
| Funda listing integration | Licensing complexity, different product domain |
| User-generated zone annotations | Liability risk if users add wrong info |
| Financial feasibility calculator | Requires separate market data integrations |
| AirDNA / rental analytics | Not core to development opportunity identification |

## Traceability

*Updated: 2026-02-11 after v3.1 roadmap creation*

| Requirement | Phase | Status |
|-------------|-------|--------|
| ZONE-01 | Phase 22 | Pending |
| ZONE-02 | Phase 22 | Pending |
| ZONE-03 | Phase 22 | Pending |
| DIVE-01 | Phase 23 | Pending |
| DIVE-02 | Phase 23 | Pending |
| DIVE-03 | Phase 23 | Pending |
| DIVE-04 | Phase 24 | Pending |
| SCORE-01 | Phase 24 | Pending |
| SCORE-02 | Phase 25 | Pending |
| LIST-01 | Phase 25 | Pending |
| LIST-02 | Phase 25 | Pending |
| LIST-03 | Phase 25 | Pending |
| MON-01 | Phase 26 | Pending |
| MON-02 | Phase 26 | Pending |
| MON-03 | Phase 26 | Pending |
| MON-04 | Phase 26 | Pending |

**Coverage:**
- v3.1 requirements: 16 total
- Mapped to phases: 16 (100% coverage ✓)
- Unmapped: 0

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after v3.1 roadmap creation*
