# Requirements: Propdex v13.0 — Juridisch Klimaat Intelligence

**Defined:** 2026-03-07
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities
**Milestone Goal:** Make jurisprudentie actually useful for vastgoedontwikkelaars — from random search dump to a real due diligence tool that answers "wat is het juridisch klimaat voor vergunningen in deze gemeente?" with location-matched, filterable court rulings.

## v13.0 Requirements

### Data Pipeline & Cache

- [x] **PIPE-01**: Dedicated `ruling_cache` PostgreSQL table (org-agnostic, ECLI as primary key) stores court ruling metadata and text
- [x] **PIPE-02**: EcliRegistry module maps 342 gemeenten to 11 rechtbanken + translates 16 pre-2013 court codes
- [x] **PIPE-03**: RechtspraakClient uses ECLI court-code prefix filtering to scope results to correct arrondissement
- [x] **PIPE-04**: RechtspraakClient supports date range filtering via API `date` parameter (from/to)
- [x] **PIPE-05**: Ruling ingestion ARQ background job fetches 50+ results per court region with batch document retrieval
- [x] **PIPE-06**: Per-gemeente caching with 7-day TTL — repeated views load from cache instantly

### Geo-Contextualization

- [x] **GEO-01**: GeoContextualizer extracts gemeente names from ruling text using regex patterns ("college van B&W van {gemeente}", "te {gemeente}", etc.)
- [x] **GEO-02**: Extracted gemeente names validated against known CBS gemeente list
- [x] **GEO-03**: Two-pass geo-scoping: ECLI prefix for arrondissement (reliable), text extraction for gemeente (supplementary)
- [x] **GEO-04**: RVS (Raad van State) rulings geo-tagged via text extraction (no geographic ECLI indicator)

### Gemeente Feed

- [ ] **FEED-01**: Auto-populated chronological jurisprudentie feed per gemeente (no manual search required)
- [ ] **FEED-02**: Rulings sorted by relevance: gemeente-matched first, then arrondissement-level
- [ ] **FEED-03**: Win/loss ratio displayed as aggregate outcome percentages (toegewezen/afgewezen/gedeeltelijk)

### AI Analysis

- [ ] **AI-01**: AI analysis runs only on filtered, location-relevant rulings (not garbage national results)
- [ ] **AI-02**: Per-ruling AI analysis caching (not per-batch) — filter changes don't trigger re-analysis
- [ ] **AI-03**: Vergunningstype classification per ruling (dakopbouw, nieuwbouw, bestemmingswijziging, etc.)
- [ ] **AI-04**: Token budget controls: truncate to OVERWEGINGEN + BESLISSING sections (max 60K input tokens)

### Doorlooptijd

- [ ] **DOOR-01**: Procedure duration calculated from ruling metadata dates (datum uitspraak, filing date)
- [ ] **DOOR-02**: Average doorlooptijd per gemeente per vergunningstype displayed as statistic
- [ ] **DOOR-03**: Graceful degradation when filing dates unavailable ("onvoldoende data")

### Explorer UI

- [ ] **EXPL-01**: Two-tab layout: Overzicht (chronological feed) and Explorer (multi-filter search)
- [ ] **EXPL-02**: Filter sidebar with scope (landelijk/provincie/gemeente), vergunningstype, uitkomst, tijdsperiode
- [ ] **EXPL-03**: Filter counts shown before applying — prevents empty result frustration
- [ ] **EXPL-04**: Pagination via useInfiniteQuery for large result sets
- [ ] **EXPL-05**: "Verbreed uw zoekopdracht" suggestions when results < 3

### Trend & Statistics

- [ ] **TREND-01**: Rolling 12-month juridisch klimaat score trend per gemeente
- [ ] **TREND-02**: Aggregated statistics bar (totaal uitspraken, gemiddelde doorlooptijd, succespercentage)
- [ ] **TREND-03**: CSS-only timeline visualization (no chart library needed for 10-20 data points)

## Future Requirements

### Deferred from v12.0

- **SCORE-01**: LocationScoreService berekent 0-10 investeerbaarheid per wijk met percentiel-rank normalisatie
- **SCORE-02**: Score bevat per-dimensie breakdown met confidence indicator
- **SCORE-03**: Wijk detail toont investeringsprofiel card met traffic-light indicatoren
- **SCORE-04**: Location score opgeslagen in aparte location_score JSONB kolom

### Advanced Legal Intelligence (v14.0+)

- **ADV-01**: Bekendmakingen-koppeling (linking rulings to SRU bekendmakingen) — no shared identifier, fuzzy matching unreliable
- **ADV-02**: Vergelijkende gemeente analyse (cross-gemeente juridisch klimaat comparison)
- **ADV-03**: Hoger beroep chain following (ECLI cross-referencing unreliable)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bekendmakingen cross-reference | No shared identifier between Rechtspraak and SRU — confirmed by research |
| Full Rechtspraak replica / Elasticsearch | Massive infra overhead, API with caching suffices |
| Juridisch advies generation | Professional liability risk (Advocatenwet) |
| spaCy/NLP for location extraction | Training data is news, not legal text; regex + known gemeente list is more reliable |
| Vergelijkende gemeente analyse | Requires core flow working first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 82 | Complete |
| PIPE-02 | Phase 82 | Complete |
| PIPE-03 | Phase 82 | Complete |
| PIPE-04 | Phase 82 | Complete |
| PIPE-05 | Phase 82 | Complete |
| PIPE-06 | Phase 82 | Complete |
| GEO-01 | Phase 83 | Complete |
| GEO-02 | Phase 83 | Complete |
| GEO-03 | Phase 83 | Complete |
| GEO-04 | Phase 83 | Complete |
| FEED-01 | Phase 83 | Pending |
| FEED-02 | Phase 83 | Pending |
| FEED-03 | Phase 83 | Pending |
| AI-01 | Phase 84 | Pending |
| AI-02 | Phase 84 | Pending |
| AI-03 | Phase 84 | Pending |
| AI-04 | Phase 84 | Pending |
| DOOR-01 | Phase 84 | Pending |
| DOOR-02 | Phase 84 | Pending |
| DOOR-03 | Phase 84 | Pending |
| EXPL-01 | Phase 85 | Pending |
| EXPL-02 | Phase 85 | Pending |
| EXPL-03 | Phase 85 | Pending |
| EXPL-04 | Phase 85 | Pending |
| EXPL-05 | Phase 85 | Pending |
| TREND-01 | Phase 86 | Pending |
| TREND-02 | Phase 86 | Pending |
| TREND-03 | Phase 86 | Pending |

**Coverage:**
- v13.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation (phases 82-86)*
