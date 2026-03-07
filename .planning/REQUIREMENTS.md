# Requirements: Propdex v12.0 — Omgevings- & Leefbaarheids-Scorer

**Defined:** 2026-03-07
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities
**Milestone Goal:** Transform Propdex from property-level "stenen en regels" intelligence into a platform that quantifies location-level commercial potential with data-driven context.

## v12.0 Requirements

### UX Architectuur

- [ ] **UX-01**: WijkDetailView en WijkMapPanel gebruiken tabbed layout (Overzicht | Demografie & Inkomen | Leefbaarheid | Juridisch | Rapporten)
- [ ] **UX-02**: LocationScoreCard shell met per-dimensie traffic-light indicators en expand-on-click progressive disclosure
- [ ] **UX-04**: ParcelDetailModal gebruikt collapsible sections gegroepeerd als Overzicht | Bouwpotentie | Risico's

### CBS Demografie & Inkomen

- [x] **DEMO-01**: Wijk detail toont leeftijdsverdeling (0-14, 15-24, 25-44, 45-64, 65+) in een visueel overzicht
- [x] **DEMO-02**: Wijk detail toont huishoudenssamenstelling (eenpersoons, zonder kinderen, met kinderen, gemiddelde grootte)
- [x] **DEMO-03**: Wijk detail toont inkomenscijfers (gemiddeld inkomen per ontvanger, per inwoner, gestandaardiseerd huishoudinkomen)
- [x] **DEMO-04**: Wijk detail toont inkomensverdeling (% laagste 40%, % hoogste 20%)
- [x] **DEMO-05**: Wijk detail toont WOZ/inkomen ratio als marktconformiteits-indicator
- [x] **DEMO-06**: Wijk detail toont vergrijzing/verjonging indicator (richting-pijl gebaseerd op leeftijdsgroepen)
- [x] **DEMO-07**: Wijk detail toont doelgroep-validatie profiel ("studentenwijk" / "gezinswijk" / "vergrijzend" / "gemengd")

### Voorzieningen Nabijheid

- [x] **VOORZ-01**: CBS Nabijheid client (86134NED) haalt afstanden op via OData v4 met dezelfde patronen als bestaande CBS client
- [ ] **VOORZ-02**: Wijk detail toont afstand tot supermarkt, huisarts, school, kinderdagverblijf, treinstation en OV-halte
- [x] **VOORZ-03**: Nabijheidsdata opgeslagen in neighborhood_metrics JSONB onder "nabijheid" key

### Criminaliteitsdata

- [ ] **CRIME-01**: OData v3 client voor dataderden.cbs.nl (47018NED) met rate limiter en retry patronen
- [ ] **CRIME-02**: Wijk detail toont totale misdrijven per 1000 inwoners + uitsplitsing (vermogensdelicten, vernieling, geweld)
- [ ] **CRIME-03**: Criminaliteitsdata opgeslagen in neighborhood_metrics JSONB onder "criminaliteit" key

### Locatie-Score & Investeringsprofiel

- [ ] **SCORE-01**: LocationScoreService berekent 0-10 investeerbaarheid per wijk met percentiel-rank normalisatie
- [ ] **SCORE-02**: Score bevat per-dimensie breakdown (demografie, inkomen, voorzieningen, veiligheid) met confidence indicator
- [ ] **SCORE-03**: Wijk detail toont investeringsprofiel card met traffic-light indicatoren per dimensie
- [ ] **SCORE-04**: Location score opgeslagen in aparte location_score JSONB kolom (Alembic migratie)

### Jurisprudentie Verdieping

- [ ] **JURIS-01**: SRU bekendmakingen worden automatisch gecorreleerd met Rechtspraak uitspraken op basis van adres/postcode/zaaknummer
- [ ] **JURIS-02**: Gecorreleerde rechtszaken worden opgeslagen bij de vergunningdata en overleven page refreshes
- [ ] **JURIS-03**: Wijk detail toont "Aangevochten vergunningen" indicator op vergunningen met gekoppelde rechtszaken
- [ ] **JURIS-04**: ParcelDetailModal toont juridisch klimaat summary card met wijk-score en perceel-specifieke rechtszaakreferenties
- [ ] **JURIS-05**: permit_precedent_benchmark integreert rechtspraak uitkomsten voor "juridisch risico" indicator per bouwtype per gemeente
- [ ] **JURIS-06**: Per-bouwtype risicovlaggen verschijnen bij consistent afwijzingspatroon in rechtspraak (bijv. "dakopbouwen: hoog bezwaarrisico")
- [ ] **JURIS-07**: Volledige testdekking voor jurisprudentie pipeline (rechtspraak client, AI analyse, endpoints, jobs)

## Future Requirements

### Multi-Year Trendanalyse (v12.1+)

- **TREND-01**: Multi-year CBS data ophalen over 3-5 peiljaren met measure code mapping per dataset
- **TREND-02**: WOZ en inkomen trend-richting indicator per wijk
- **TREND-03**: Sparkline trend charts voor kernmetrieken
- **TREND-04**: Gentrification early warning (WOZ-groei vs inkomen-stagnatie divergentie)

### Score Verfijning (v12.1+)

- **SCORE-05**: Per-organisatie weight override via config (niet UI)
- **SCORE-06**: Score customization met weight sliders (pas na user feedback)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time crime feed / incident map | Noisy, misleading; CBS annual aggregates are methodologically sound |
| Custom isochrone / travel-time calculations | CBS nabijheid pre-computes road distances — eliminates need |
| Satellite imagery gentrification detection | Research-grade (74% accuracy), not production-ready |
| Bevolkingsprognose at wijk level | CBS only publishes regional prognoses; speculative at wijk level |
| Full CBS dataset sync (100+ variables) | Curated ~25 PropTech-relevant fields — fast, focused, maintainable |
| Veiligheidsmonitor leefbaarheidsperceptie | Survey-based, regional only (not wijk), biannual — objective metrics preferred |
| OV-score / PTAL calculation | CBS afstand tot treinstation + OV-halte covers this simpler |
| Score customization UI with weight sliders | Premature; ship opinionated defaults, iterate on weights |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 77.1 | Pending |
| UX-02 | Phase 77.1 | Pending |
| UX-04 | Phase 77.1 | Pending |
| DEMO-01 | Phase 78 | Complete |
| DEMO-02 | Phase 78 | Complete |
| DEMO-03 | Phase 78 | Complete |
| DEMO-04 | Phase 78 | Complete |
| DEMO-05 | Phase 78 | Complete |
| DEMO-06 | Phase 78 | Complete |
| DEMO-07 | Phase 78 | Complete |
| VOORZ-01 | Phase 79 | Complete |
| VOORZ-02 | Phase 79 | Pending |
| VOORZ-03 | Phase 79 | Complete |
| CRIME-01 | Phase 80 | Pending |
| CRIME-02 | Phase 80 | Pending |
| CRIME-03 | Phase 80 | Pending |
| SCORE-01 | Phase 81 | Pending |
| SCORE-02 | Phase 81 | Pending |
| SCORE-03 | Phase 81 | Pending |
| SCORE-04 | Phase 81 | Pending |
| JURIS-01 | Phase 82 | Pending |
| JURIS-02 | Phase 82 | Pending |
| JURIS-03 | Phase 82 | Pending |
| JURIS-04 | Phase 83 | Pending |
| JURIS-05 | Phase 83 | Pending |
| JURIS-06 | Phase 83 | Pending |
| JURIS-07 | Phase 84 | Pending |

**Coverage:**
- v12.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after jurisprudentie phases added*
