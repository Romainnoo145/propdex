# CRM Plus — Requirements

## Milestone 1: Core Intelligence Engine

The MVP — enter an address, get instant property intelligence. Prove the speed value proposition.

### Property Intelligence

- [x] **PROP-01**: User can enter a Dutch address and trigger a property intelligence lookup
- [x] **PROP-02**: Report includes kadaster property data (ownership, transactions, plot boundaries, surface area)
- [x] **PROP-03**: Report includes bestemmingsplan summary (permitted functions, max height, density, parking requirements)
- [x] **PROP-04**: Report includes monument/heritage status (rijksmonument, gemeentelijk monument, or none) with applicable restrictions
- [ ] **PROP-05**: AI parsing of bestemmingsplan PDFs extracts zoning rules when structured API data is insufficient
- [x] **PROP-06**: Each data field in the report shows its source (API vs AI-parsed) with confidence indicator

### Report Management

- [ ] **RPT-01**: User can save a property intelligence report for later reference
- [ ] **RPT-02**: User can view a list of all saved reports
- [ ] **RPT-03**: User can re-open a saved report and see full details

### Infrastructure

- [x] **INFRA-01**: User can log in and log out securely
- [x] **INFRA-02**: All data is isolated by organization (multi-tenant)
- [x] **INFRA-03**: Government API responses are cached with appropriate TTLs to avoid redundant calls
- [ ] **INFRA-04**: AI document parsing runs asynchronously (user sees progress, not a timeout)

---

## Milestone 2: Professional Platform

The full professional tool — map visualization, deal pipeline, document export, subsidy intelligence.

### Enhanced Property Data

- [ ] **PROP-07**: Address input with BAG autocomplete suggestions
- [ ] **PROP-08**: Report includes basic building characteristics from BAG (building type, construction year, surface area, usage)
- [ ] **PROP-09**: Interactive map visualization with property location on PDOK tile layers
- [ ] **PROP-10**: Environmental constraints summary (soil contamination indicators, noise zones from Atlas Leefomgeving)

### Subsidy & Financial Intelligence

- [ ] **FIN-01**: Automatic matching of property with eligible subsidies (heritage, sustainability, innovation)
- [ ] **FIN-02**: Erfpacht status and conditions analysis where applicable
- [ ] **FIN-03**: Basic financial feasibility indicator (estimated development costs vs market value range)
- [ ] **FIN-04**: Constraint scoring — automated go/no-go score based on zoning + costs + restrictions

### Deal Pipeline

- [ ] **PIPE-01**: Property pipeline board with configurable stages (new → researching → go/no-go → acquired → developing)
- [ ] **PIPE-02**: User can move properties between pipeline stages
- [ ] **PIPE-03**: Pipeline overview with filters and sorting
- [ ] **PIPE-04**: Notes and attachments per property in pipeline

### Document & Reporting

- [ ] **DOC-01**: PDF export of property intelligence report (branded, professional layout)
- [ ] **DOC-02**: Comparison view — side-by-side comparison of 2-3 properties
- [ ] **DOC-03**: Historical data — show previous reports for same property to track changes

### Advanced Intelligence

- [ ] **ADV-01**: Zoning change history — detect recent or pending bestemmingsplan modifications
- [ ] **ADV-02**: Neighborhood development pipeline — show other known developments nearby
- [ ] **ADV-03**: Church/monument-specific intelligence module (original function, protection level, previous conversions in area)

### Platform Expansion

- [ ] **PLAT-01**: Role-based access (admin, analyst, viewer) for larger teams
- [ ] **PLAT-02**: Usage dashboard and API call monitoring
- [ ] **PLAT-03**: Responsive mobile companion for on-site property checks
- [ ] **PLAT-04**: AI chatbot for property questions (ask questions about any saved report)

---

## Out of Scope (Both Milestones)

- 3D visualization / virtual tours — separate product domain, possible integration later
- Automated subsidy application filing — requires deep government system integration
- Automated permit (vergunning) filing — requires municipal system integration
- AI-generated marketing photos/videos — marketing product, not intelligence
- Buyer/investor CRM for selling finished units — different product entirely
- Construction project management — different product category
- Full valuation/taxatie system — regulated activity requiring licensed appraisers

---

## Traceability

### Milestone 1: Core Intelligence Engine

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PROP-01 | Phase 2 - Core Data Pipeline | Complete |
| PROP-02 | Phase 2 - Core Data Pipeline | Complete |
| PROP-03 | Phase 3 - Zoning & Monument Intelligence | Complete |
| PROP-04 | Phase 3 - Zoning & Monument Intelligence | Complete |
| PROP-05 | Phase 4 - AI Document Parsing | Pending |
| PROP-06 | Phase 3 - Zoning & Monument Intelligence | Complete |
| RPT-01 | Phase 5 - Report Management | Pending |
| RPT-02 | Phase 5 - Report Management | Pending |
| RPT-03 | Phase 5 - Report Management | Pending |
| INFRA-01 | Phase 1 - Foundation & Authentication | Complete |
| INFRA-02 | Phase 1 - Foundation & Authentication | Complete |
| INFRA-03 | Phase 2 - Core Data Pipeline | Complete |
| INFRA-04 | Phase 4 - AI Document Parsing | Pending |

**Coverage:** 14/14 Milestone 1 requirements mapped ✓

---
*Last updated: 2026-02-07 after Phase 3 completion*
