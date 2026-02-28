# Requirements: Propdex v8.0 — Client Demo Readiness

**Defined:** 2026-02-28
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities

## v8.0 Requirements

Requirements for making Venlo the showcase gemeente with complete data and polished presentation for client PVP.

### Scan Pipeline Reliability

- [ ] **SCAN-01**: Scan pipeline retries BAG WFS fetch on failure instead of silently continuing with no building data
- [ ] **SCAN-02**: Scan pipeline validates BAG coverage ratio and warns if suspiciously low (>90% has_pand=false)
- [ ] **SCAN-03**: Existing scan data can be backfilled by re-running a wijk scan with --force-all

### Data Completeness

- [ ] **DATA-01**: All 21 Venlo wijken have complete scan data with bouwjaar populated for parcels with buildings
- [ ] **DATA-02**: All parcels with buildings have resolved addresses via PDOK reverse geocoding
- [ ] **DATA-03**: Parcel scoring accurately reflects BAG pand_status (in_gebruik vs leeg vs buiten_gebruik)

### Map Visualization

- [ ] **MAP-01**: BAG building footprints visible as toggleable map layer
- [ ] **MAP-02**: Score colors accurately reflect opportunity level after data fix
- [ ] **MAP-03**: Map visual clarity improved (readable labels, clear parcel boundaries, no overlapping elements)

### Report Polish

- [ ] **RPT-01**: Report layout and formatting polished for client presentation
- [ ] **RPT-02**: All v7.x data sections (WOZ, energielabel, BRK, buildability, Wkb, permit precedents) render cleanly in report view
- [ ] **RPT-03**: PDF export generates a presentable document with all report sections
- [ ] **RPT-04**: Report includes "Actie vereist" section that surfaces actionable warnings based on existing data (Wkb-plichtig, asbestrisico bij bouwjaar <1994, vergunningsstatus)

### Results Table

- [ ] **RES-01**: Results table filters out noise to surface genuine development opportunities
- [ ] **RES-02**: Default view prioritizes high-value parcels (vacant land, old buildings, residential zoning)

## Future Requirements

Deferred to v9.0+ — Lead marketplace and professional workflow platform.

- **LEAD-01**: Professional partner onboarding flow (kwaliteitsborgers, tekenaars, constructeurs, bodem/asbestonderzoekers, aannemers)
- **LEAD-02**: Lead routing and notification system (qualified lead → matched professional)
- **LEAD-03**: "Genereer startdossier Risicobeoordeling" one-click document generation for kwaliteitsborgers
- **LEAD-04**: Partner dashboard with lead tracking and conversion metrics
- **LEAD-05**: No cure, no pay billing model (€25-50 per contacted lead)
- **LEAD-06**: User journey design: natural flow from data check → professional recommendation → offerte aanvraag

## Out of Scope

| Feature | Reason |
|---------|--------|
| Lead marketplace / partner routing | v9.0+ — requires partner onboarding, billing, legal agreements |
| Startdossier Risicobeoordeling PDF generation | v9.0+ — requires Wkb-specific document templates and partner workflow |
| Professional partner dashboard | v9.0+ — separate user role and interface |
| Payment/billing infrastructure | v9.0+ — no monetization in demo phase |
| Bodemkwaliteit data integration | v9.0+ — requires new data source (RIVM/BRO) |
| Non-Venlo gemeente data fixes | v8.0 focuses on Venlo showcase only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | — | Pending |
| SCAN-02 | — | Pending |
| SCAN-03 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| MAP-01 | — | Pending |
| MAP-02 | — | Pending |
| MAP-03 | — | Pending |
| RPT-01 | — | Pending |
| RPT-02 | — | Pending |
| RPT-03 | — | Pending |
| RPT-04 | — | Pending |
| RES-01 | — | Pending |
| RES-02 | — | Pending |

**Coverage:**
- v8.0 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
