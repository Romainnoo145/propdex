# Requirements: Propdex v14.0 Fysiek Risicoprofiel

**Defined:** 2026-03-09
**Core Value:** Per-parcel physical risk assessment -- foundation risk, asbestos exposure, and soil classification -- so developers can see hidden structural costs before spending a cent on acquisition.

## v14.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Soil Intelligence

- [x] **BODEM-01**: User sees soil type classification (klei/veen/zand/leem) for any parcel via BRO Bodemkaart WMS
- [x] **BODEM-02**: User sees PDOK Funderingsrisicogebieden context (% pre-1970, soil region, risk label) for parcel's postal code area

### Foundation Risk

- [x] **FUND-01**: User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype heuristic
- [x] **FUND-02**: User sees combined Fysiek Risicoprofiel summary with traffic-light rating and Dutch-language explanation
- [x] **FUND-03**: User sees KCAF reference cost range for foundation repair based on pand footprint and risk level

### Asbestos Enhancement

- [x] **ASBT-01**: User sees refined asbestos risk that accounts for BAG gebruiksdoel (industrial/educational = higher risk)
- [x] **ASBT-02**: Asbestos v2 never reduces risk below bouwjaar baseline (gebruiksdoel is additive only)

### Frontend Integration

- [x] **FRNT-01**: User sees Fysiek Risicoprofiel section in ParcelDetailModal with sub-cards for bodem, fundering, asbest, and verontreiniging
- [x] **FRNT-02**: All risk indicators display amber confidence badges with source attribution and "indicatief" disclaimers
- [ ] **FRNT-03**: Area scan map tiles color parcels by foundation risk level alongside existing opportunity score

## Future Requirements

### Physical Risk Extensions

- **KLIM-01**: User sees drought/subsidence risk context from Klimaateffectatlas
- **ASBT-03**: User sees indicative asbestos remediation cost range
- **BODEM-03**: User sees soil profile depth view (layer composition to 1.2m)
- **FUND-04**: User sees foundation risk aggregated at wijk level in gemeente detail view

### Deferred from v12.0

- **SCORE-01**: LocationScoreService berekent 0-10 investeerbaarheid per wijk met percentiel-rank normalisatie
- **SCORE-02**: Score bevat per-dimensie breakdown met confidence indicator
- **SCORE-03**: Wijk detail toont investeringsprofiel card met traffic-light indicatoren
- **SCORE-04**: Location score opgeslagen in aparte location_score JSONB kolom

## Out of Scope

| Feature | Reason |
|---------|--------|
| Foundation inspection report | Legal liability -- only SC530/F3O-certified firms may perform funderingsonderzoek |
| Asbestinventarisatie | NEN 2991 requires physical inspection by certified asbestinventarisatiebedrijf |
| FunderMaps integration | Proprietary data, commercial API, only ~35% coverage of pre-1970 buildings |
| BRO grondwater monitoring | Only ~380 wells nationwide (~10km apart) -- too sparse for per-parcel assessment |
| Amsterdam bouwdossier archive | Only Amsterdam has digital API -- not worth building for single city |
| ML-based foundation risk model | No public training data exists -- deterministic heuristic is more explainable |
| Precise cost calculations | Too many variables -- at most show KCAF reference ranges with disclaimers |
| Sloopmelding/asbestmelding filing | Government integration, regulated process, out of scope for intelligence platform |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BODEM-01 | Phase 87 | Complete |
| BODEM-02 | Phase 87 | Complete |
| FUND-01 | Phase 88 | Complete |
| FUND-02 | Phase 88 | Complete |
| FUND-03 | Phase 88 | Complete |
| ASBT-01 | Phase 89 | Complete |
| ASBT-02 | Phase 89 | Complete |
| FRNT-01 | Phase 90 | Complete |
| FRNT-02 | Phase 90 | Complete |
| FRNT-03 | Phase 90 | Pending |

**Coverage:**
- v14.0 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
