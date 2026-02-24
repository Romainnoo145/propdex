# Requirements: Propdex v7.0 — Deep Property Data

**Defined:** 2026-02-24
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities

## v7.0 Requirements

### Energielabel (EP-Online)

- [ ] **NRG-01**: Report fetches energielabel klasse (A++++ to G) from EP-Online V5 API by BAG VBO ID
- [ ] **NRG-02**: Report displays registratiedatum and 10-year geldigheid status (valid/expired)
- [ ] **NRG-03**: Properties without registered label show "Niet geregistreerd" (not an error — ~20-30% of properties)
- [ ] **NRG-04**: Monument properties without label show compliance warning (May 2026 obligation)
- [ ] **NRG-05**: Frontend EnergieLabelSection with EU color-coded badge (A=green to G=red)

### WOZ-waarde

- [ ] **WOZ-01**: Report fetches WOZ-waarde from public endpoint (waardeloket or Objectinformatie API)
- [ ] **WOZ-02**: WOZ-waarde always displayed together with waardepeildatum (mandatory context)
- [ ] **WOZ-03**: WOZ per m² derived from `woz_waarde / oppervlakte` when building data available
- [ ] **WOZ-04**: Low-confidence disclaimer shown when using unofficial waardeloket endpoint
- [ ] **WOZ-05**: Frontend WOZSection with value, peildatum, and per-m² calculation

### BRK Eigendom

- [ ] **BRK-01**: Report fetches ownership data from BRK Bevragen V2 (existing client, needs wiring)
- [ ] **BRK-02**: Display eigenaar type (natuurlijk persoon / rechtspersoon / overheid) — never show personal names
- [ ] **BRK-03**: Display zakelijk recht type and hypotheek indicator (boolean)
- [ ] **BRK-04**: BRK data is NEVER cached or stored — stripped from report before DB save (Kadaster Tier 3)
- [ ] **BRK-05**: Graceful degradation when BRK is unconfigured (PKIOverheid cert pending)
- [ ] **BRK-06**: Frontend EigendomSection with "Actueel opgevraagd" timestamp, owner list, rights

### RCE Monument Enrichment

- [ ] **RCE-01**: When monument detected (existing PDOK spatial), fetch detail from RCE Linked Data API
- [ ] **RCE-02**: Display redengevende omschrijving in collapsible section (can be 1,000-5,000 words)
- [ ] **RCE-03**: Display oorspronkelijke functie and bouwperiode when available
- [ ] **RCE-04**: All monument labels say "Rijksmonument (RCE)" not generic "Monument"

### Schema & Infrastructure

- [ ] **INF-01**: Pydantic schemas for EnergyLabel, WOZData, BRKOwnership with all response fields
- [ ] **INF-02**: PropertyReportResponse extended with 3 new Optional sections
- [ ] **INF-03**: Cache TTL entries for ep_online (30d), woz (365d), rce_detail (30d) — BRK excluded
- [ ] **INF-04**: EP_ONLINE_API_KEY setting in config; rate limiters for EP-Online and RCE detail
- [ ] **INF-05**: Completeness score denominator updated (6 → 9 sections) with graceful handling of existing reports

### Aggregator Integration

- [ ] **AGG-01**: property_aggregator restructured into Step 2a (existing) / Step 2b (BRK after cadastral)
- [ ] **AGG-02**: EP-Online, WOZ, and RCE detail fetched in parallel via asyncio.gather
- [ ] **AGG-03**: BRK ownership stripped from PropertyReportResponse before JSONB save in reports/service.py
- [ ] **AGG-04**: Monument aggregator extended with two-step enrichment (PDOK spatial → RCE Linked Data)

## v7.1 Requirements (Deferred)

### Future Enhancements

- **WOZ-HIST**: WOZ historical values across multiple years (requires separate API subscription)
- **WOZ-DELTA**: WOZ vs market value delta analysis (requires transaction data)
- **RCE-COMPLEX**: Deep-linking to RCE complex membership details
- **GEM-MON**: Gemeentelijke monumenten integration (no national API — per-gemeente effort)
- **BRK-CERT**: PKIOverheid certificate lifecycle management and auto-renewal monitoring

## Out of Scope

| Feature | Reason |
|---------|--------|
| Display BRK natural person names/addresses | AVG/GDPR exposure — show "Particulier eigenaar" only |
| Cache/store BRK eigendomsdata | Kadaster Tier 3 terms violation |
| Full redengevende omschrijving as raw text dump | Must be collapsible, not inline |
| WOZ bezwaar workflow | Developer use case, not residential |
| Apply for official WOZ Bevragen API | Municipalities-only, SaaS will be rejected |
| WOZ historical trend charts | Requires separate subscription (v7.1+) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INF-01 | Phase 52 | Pending |
| INF-02 | Phase 52 | Pending |
| INF-03 | Phase 52 | Pending |
| INF-04 | Phase 52 | Pending |
| INF-05 | Phase 52 | Pending |
| NRG-01 | Phase 53 | Pending |
| NRG-03 | Phase 53 | Pending |
| RCE-01 | Phase 53 | Pending |
| RCE-03 | Phase 53 | Pending |
| RCE-04 | Phase 53 | Pending |
| WOZ-01 | Phase 54 | Pending |
| WOZ-04 | Phase 54 | Pending |
| BRK-01 | Phase 54 | Pending |
| BRK-04 | Phase 54 | Pending |
| BRK-05 | Phase 54 | Pending |
| AGG-01 | Phase 55 | Pending |
| AGG-02 | Phase 55 | Pending |
| AGG-03 | Phase 55 | Pending |
| AGG-04 | Phase 55 | Pending |
| NRG-02 | Phase 56 | Pending |
| NRG-04 | Phase 56 | Pending |
| NRG-05 | Phase 56 | Pending |
| WOZ-02 | Phase 56 | Pending |
| WOZ-03 | Phase 56 | Pending |
| WOZ-05 | Phase 56 | Pending |
| BRK-02 | Phase 56 | Pending |
| BRK-03 | Phase 56 | Pending |
| BRK-06 | Phase 56 | Pending |
| RCE-02 | Phase 56 | Pending |

**Coverage:**
- v7.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after research synthesis*
