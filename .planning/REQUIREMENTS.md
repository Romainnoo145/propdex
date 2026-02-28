# Requirements: Propdex v9.0 — Professional Marketplace

**Defined:** 2026-03-01
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities
**Milestone Goal:** Transform Propdex from data analysis tool into lead generation platform, starting with kwaliteitsborgers (Wkb) as first vertical.

## v9.0 Requirements

Requirements for the kwaliteitsborger lead generation vertical — from Wkb classification through dossier generation to professional matching.

### Wkb Intelligence

- [ ] **WKB-01**: User can see gevolgklasse classification (1/2/3) for any property in the report, labeled as "indicatief"
- [ ] **WKB-02**: User can see asbest risk indicator based on bouwjaar (hoog: 1963-1993, middel: pre-1963, geen: post-1993) in the report
- [ ] **WKB-03**: Verbouwing projects are flagged with "Wkb niet van toepassing" notice (Dec 2024 ministerial ruling)
- [ ] **WKB-04**: Wkb classification excludes rijksmonumenten (monument status from existing RCE data)

### Bodemkwaliteit

- [ ] **BODEM-01**: System queries Bodemloket for soil contamination data at parcel coordinates
- [ ] **BODEM-02**: Property report includes "Bodemkwaliteit" section showing contamination status and WBB dossier references
- [ ] **BODEM-03**: Absent Bodemloket data displayed as "geen gegevens beschikbaar" (never "schone grond")

### Risicobeoordeling Dossier

- [ ] **DOSSIER-01**: User can generate a "Risicobeoordeling Startdossier" PDF for any property
- [ ] **DOSSIER-02**: Dossier includes: perceelgegevens, bouwjaar, bodemkwaliteit, bestemmingsplan, monumentstatus, energielabel, Wkb classificatie
- [ ] **DOSSIER-03**: Dossier includes legal disclaimer (data is indicatief, assembled from public sources)

### Lead Capture

- [ ] **LEAD-01**: User sees "Schakel kwaliteitsborger in" CTA when property is Wkb-plichtig (GK1)
- [ ] **LEAD-02**: User can submit a lead request with project details (type, omschrijving, gewenste startdatum)
- [ ] **LEAD-03**: Lead request triggers email notification to matched kwaliteitsborger(s)
- [ ] **LEAD-04**: Lead request includes the generated risicobeoordeling dossier as attachment

### Professional Directory

- [ ] **DIR-01**: Admin can add kwaliteitsborger profiles (naam, bedrijf, werkgebied, gevolgklassen, contact)
- [ ] **DIR-02**: Kwaliteitsborgers matched to leads based on werkgebied (gemeente) and gevolgklasse
- [ ] **DIR-03**: Professional profiles are platform-wide (not tenant-isolated) with admin-only management
- [ ] **DIR-04**: Professional profile links to TloKB public register for verification

### Privacy & Consent

- [ ] **AVG-01**: User gives explicit consent before contact data is shared (two-step consent screen)
- [ ] **AVG-02**: Consent logged with timestamp, scope, and user identity for audit trail
- [ ] **AVG-03**: Privacy policy section explains data sharing with professionals

## v8.0 Requirements (In Progress)

Previous milestone — Client Demo Readiness. Tracked in `.planning/ROADMAP.md` phases 62-66.

- [x] **SCAN-01**: BAG WFS retry on failure
- [x] **SCAN-02**: BAG coverage ratio validation
- [x] **SCAN-03**: Force-all backfill mode
- [ ] **DATA-01-03**: Venlo data completeness (Phase 63)
- [ ] **MAP-01-03**: Map visualization polish (Phase 64)
- [ ] **RPT-01-04**: Report polish (Phase 65)
- [ ] **RES-01-02**: Results table noise reduction (Phase 66)

## Future Requirements

Deferred to v10.0+ — expanding the marketplace beyond kwaliteitsborgers.

- **VERT-01**: Additional professional verticals: bouwkundig tekenaars, constructeurs, asbest/bodem onderzoekers, aannemers
- **VERT-02**: Professional self-registration and profile management
- **PAY-01**: Credit system / per-lead billing (Stripe integration)
- **PAY-02**: Monthly subscription plans for professionals
- **API-01**: B2B API for large borgingspartijen (Woningborg, Kiwa)
- **DASH-01**: Professional dashboard with lead tracking and conversion metrics
- **PIPE-01**: Lead pipeline stages: Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple professional verticals | v9.0 proves model with one vertical (kwaliteitsborgers) first |
| Payment infrastructure | Handle billing manually; no Stripe/payment in v9.0 |
| Professional self-registration | Admin-managed directory in v9.0; self-serve in v10.0 |
| Open bidding / price comparison | Anti-pattern for kwaliteitsborger relationships (long-term, legally constrained) |
| Automated TloKB verification | No public API; manual admin verification in v9.0 |
| GK2/GK3 detailed classification | Not yet mandated as of 2026; GK1 only in v9.0 |
| Gemeentelijk monument data | RCE rijksmonumenten only; gemeentelijke monumenten require per-gemeente integration |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WKB-01 | Phase 67 | Pending |
| WKB-02 | Phase 67 | Pending |
| WKB-03 | Phase 67 | Pending |
| WKB-04 | Phase 67 | Pending |
| BODEM-01 | Phase 68 | Pending |
| BODEM-02 | Phase 68 | Pending |
| BODEM-03 | Phase 68 | Pending |
| DOSSIER-01 | Phase 69 | Pending |
| DOSSIER-02 | Phase 69 | Pending |
| DOSSIER-03 | Phase 69 | Pending |
| LEAD-01 | Phase 71 | Pending |
| LEAD-02 | Phase 71 | Pending |
| LEAD-03 | Phase 71 | Pending |
| LEAD-04 | Phase 71 | Pending |
| DIR-01 | Phase 70 | Pending |
| DIR-02 | Phase 70 | Pending |
| DIR-03 | Phase 70 | Pending |
| DIR-04 | Phase 70 | Pending |
| AVG-01 | Phase 71 | Pending |
| AVG-02 | Phase 71 | Pending |
| AVG-03 | Phase 71 | Pending |

**Coverage:**
- v9.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 — traceability completed, all 21 requirements mapped to Phases 67-71*
