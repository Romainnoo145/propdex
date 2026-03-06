# Feature Research

**Domain:** Dutch PropTech — Open Data Intelligence (CBS + Rechtspraak + AI Legal Analysis)
**Researched:** 2026-03-06
**Confidence:** HIGH — APIs verified live, existing codebase inspected, XML/OData responses confirmed

---

## Context: What's Already Built

Before categorizing features, note what's already partially implemented in the codebase:

**CBS OData client** (`backend/app/government_apis/cbs_odata.py`):
- `CBSODataClient` exists, targets dataset `85618NED` (2023 Kerncijfers wijken en buurten)
- Uses OData v3-style URL (`opendata.cbs.nl/ODataApi/OData`) — needs migration to OData v4 (`datasets.cbs.nl/odata/v1/CBS/`)
- Resolves gemeente/wijk name → CBS region key → fetches neighborhood data
- Returns: `gemiddelde_woz_waarde`, `stedelijkheid` (klasse + omschrijving + OAD), demographics, bouwjaar distribution
- Called in `area_scan.py` ARQ job — result stored as `neighborhood_metrics` JSONB on `AreaScan` model
- Schema field `neighborhood_metrics: dict | None` exposed in `ScanStatusResponse`
- Frontend type `neighborhood_metrics?: Record<string, any> | null` in scan.ts

**Rechtspraak client** (`backend/app/government_apis/rechtspraak.py`):
- `RechtspraakClient` exists with `search_jurisprudence()` and `get_jurisprudence_document()`
- Search via Atom feed at `data.rechtspraak.nl/uitspraken/zoeken?searchterms=...`
- Document fetch via `data.rechtspraak.nl/uitspraken/content?id=ECLI:...`
- Rate limit semaphore (5 concurrent max out of 10/sec API limit)
- Returns: ecli, title, summary, date (search); ecli, text, instantie, datum_uitspraak (document)

**Backend endpoint** (`backend/app/api/endpoints/jurisprudence.py`):
- `GET /api/jurisprudence/search?q=...&max_results=10&sort=DESC` — live
- `GET /api/jurisprudence/doc/{ecli}` — live

**Frontend** (`JurisprudenceSection.tsx`, `useJurisprudence.ts`):
- Full search UI with debounced input, results list, split-pane document viewer — live
- Rendered inside `WijkDetailView.tsx` with default query `"omgevingsvergunning {gemeenteNaam}"`

**NOT yet built:**
- CBS neighborhood metrics display in UI (data is fetched, stored, but not rendered)
- AI-powered legal precedent analysis (no Claude integration for Rechtspraak documents)
- Vergunnings-succeskans score from court rulings
- OData v4 migration (client uses v3 endpoint)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features developers and users will expect once told "we have CBS neighborhood data and court rulings."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CBS metrics visible in scan results | Data is fetched during scan — not showing it is a broken experience | LOW | Data already in `neighborhood_metrics` JSONB, only needs frontend `NeighborhoodMetricsCard` in `WijkDetailView` |
| Average WOZ value per wijk | Core market context for transformation potential — "is this a rising or depressed market?" | LOW | Already fetched: `gemiddelde_woz_waarde` from CBS measure code `M001642` |
| Urbanization class display | Determines project type viability (dense urban = apartments, rural = different rules) | LOW | Already fetched: `stedelijkheid.klasse` (1-5 scale) + `omgevingsadressendichtheid` |
| Search court rulings by gemeente/type | Primary utility of Rechtspraak integration — "what happened in Rotterdam with church conversions?" | LOW | Backend + frontend already live; verify `searchterms` parameter reliability |
| Read full court ruling inline | Developers need to read actual ruling text to assess precedent before calling their lawyer | LOW | Already in `JurisprudenceViewer` component with split-pane layout |
| Court ruling metadata (court, date, ECLI) | Minimal context to evaluate relevance before clicking through | LOW | Already in `JurisprudenceSection.tsx` — ecli, title, date shown |
| Recent rulings as default view | Show latest relevant rulings without requiring manual search query input | LOW | Default query already set to `"omgevingsvergunning {gemeenteNaam}"` |
| CBS dataset freshness indication | Users need to know if statistics are 2023 or 2024 to calibrate trust | LOW | `peiljaar` already in CBS client response, needs display in UI |

### Differentiators (Competitive Advantage)

Features that turn raw data into actionable intelligence — the core Propdex value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-generated juridisch klimaat summary | Developer cannot read 50 court rulings — Claude synthesizes "In Rotterdam, courts consistently reject height deviations above 3 floors in residential areas" | HIGH | Requires Claude integration, Dutch legal prompt engineering, cost management via inhoudsindicatie batching |
| Vergunnings-succeskans score | Single number (e.g., "67% success rate for woningbouw in this gemeente based on last 3 years") gives direct go/no-go signal | HIGH | Requires ruling outcome classification (granted/rejected/modified) per case, then statistical aggregation |
| Ruling outcome classification badge | Each ruling tagged as "Verleend / Geweigerd / Deels toegewezen" without reading full text | MEDIUM | Use Claude on inhoudsindicatie (100-300 chars per ruling) — low cost, high efficiency |
| CBS market context card | Visual card in WijkDetailView: WOZ avg, huurwoningen%, bevolkingsdichtheid, inkomen — contextualizes opportunity score | MEDIUM | Data already fetched, needs `NeighborhoodMetricsCard` component |
| Omgevingsrecht search filter | Pre-filter search to bestuursrecht/omgevingsrecht to eliminate irrelevant rulings | MEDIUM | Rechtspraak API supports `subject=http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht` — needs UI filter |
| CBS scoring contribution to opportunity score | Integrate stedelijkheid + WOZ level into parcel opportunity score (high-WOZ wijk = better demand signal) | MEDIUM | Requires changes to scoring algorithm in `area_scan.py` — currently uses only BAG/bestemmingsplan data |
| Risk flag: frequent appellants | "This gemeente has 3 active appeal organizations blocking 40% of residential projects" — extracted from recurring plaintiff names | HIGH | Requires named entity extraction across rulings, clustering by appellant identity across cases |
| CBS trends over time | "This wijk's WOZ rose 18% in 3 years" — market momentum indicator for investment thesis | HIGH | Requires fetching multiple dataset years (85618NED=2023, 85984NED=2024, 86165NED=2025), joining by wijk code |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time court ruling alerts | "Notify me when a new ruling appears for my gemeente" | Rechtspraak is daily-updated not real-time; alert fatigue (80% rulings are irrelevant); complex webhook/polling infrastructure | Weekly AI digest: summarize new relevant rulings for monitored gemeenten, not per-ruling push |
| Full-text search within ruling documents | "Find all cases mentioning stikstof in Amsterdam" | The `data.rechtspraak.nl/zoeken` endpoint does NOT support full-text search within documents — only title/metadata. The hidden `uitspraken.rechtspraak.nl/api/zoek` is undocumented and unstable | Use searchterms in public API + AI extraction on fetched documents; surface via AI-generated topical summaries |
| CBS data at parcel level | "Show me the WOZ per individual parcel from CBS" | CBS statistics are at buurt/wijk level only, not parcel level. Individual parcel WOZ comes from Waardeloket (already built in v7.0) | Show CBS wijk-level averages as market context; per-parcel WOZ from Waardeloket |
| Automated permit success prediction with confidence scores | "Tell me if my permit will be approved with 92% confidence" | AI cannot make legal predictions without liability risk; courts are unpredictable; "92% success" claim invites complaints when rejected | Frame as "historical precedent context" not prediction: "In 18 of 24 similar cases in this gemeente, vergunning was granted" |
| Complete CBS dataset sync | "Pull all 100+ CBS fields into the database" | 100+ measure fields x 12,000+ wijken = massive payload; most fields irrelevant to PropTech (jeugdzorg, WMO, brandstoftype auto's); slows scan job | Curated 10-field selection: WOZ, stedelijkheid, woningvoorraad, huurwoningen%, inkomen, bevolkingsdichtheid — already in existing CBS client |
| Vergunning processing time benchmark | "How long does Amsterdam take to process permits?" | Not extractable from court rulings (rulings cover appeals, not first-instance timelines); Omgevingsloket wettelijk monopolie Art. 16.1 | Use bekendmakingen (already built) as proxy for permit activity volume per gemeente |

---

## Feature Dependencies

```
CBS OData v4 migration
    └──enables──> Reliable CBS data fetch (v3 endpoint may be deprecated)
                      └──enables──> CBS metrics visible in scan results (UI)
                                        └──enables──> CBS scoring contribution to opportunity score

JurisprudenceSection (LIVE)
    └──enables──> Search + read court rulings (already works)
                      └──enables──> Omgevingsrecht filter
                      └──enables──> Ruling outcome classification (AI on inhoudsindicatie)
                                        └──enables──> Vergunnings-succeskans score
                                                          └──enables──> AI juridisch klimaat summary
                                        └──enables──> Frequent appellant detection

AI juridisch klimaat summary
    └──requires──> Ruling outcome classification (need structured data before aggregating)
    └──requires──> Sufficient ruling corpus (5+ rulings per gemeente for meaningful stats)
    └──requires──> Claude API integration (already exists in app for bestemmingsplan parsing)
```

### Dependency Notes

- **CBS UI requires no backend work.** Data already fetched and stored in `neighborhood_metrics` JSONB. Only frontend rendering needed — a `NeighborhoodMetricsCard` component. Fastest win in the milestone.
- **AI analysis builds on existing Rechtspraak search.** Search is live so AI analysis can start immediately once Claude integration is added to a new ARQ-based analysis job.
- **Vergunnings-succeskans requires ruling outcome classification first.** Cannot compute success rate without classifying each ruling as granted/rejected. Classification should happen lazily (on-fetch) using Claude on the inhoudsindicatie text (efficient: ~200 tokens per ruling).
- **OData v4 migration is non-blocking but urgent.** CBS client uses OData v3 URL which CBS is actively migrating away from. Migration to `datasets.cbs.nl/odata/v1/CBS/` also requires updating field name lookups to use measure codes (e.g. `M001642` for WOZ) instead of column names.

---

## MVP Definition

This is a subsequent milestone on an existing production platform. "MVP" means minimum work to deliver meaningful user value on each of the three feature tracks.

### Track 1: CBS Neighborhood Scoring — Launch With

- [x] CBS OData client exists and fetches during scan (DONE)
- [x] `neighborhood_metrics` stored in AreaScan JSONB (DONE)
- [ ] Migrate CBS client to OData v4 endpoint + updated measure code field names
- [ ] Update to latest dataset (85984NED = 2024 or 86165NED = 2025)
- [ ] `NeighborhoodMetricsCard` component in `WijkDetailView` — display WOZ avg, stedelijkheid, demografie, woningtypen
- [ ] Handle `None` gracefully with "Geen CBS data beschikbaar" fallback

### Track 2: Rechtspraak Jurisprudence — Launch With

- [x] Backend search endpoint live (DONE)
- [x] Backend document fetch endpoint live (DONE)
- [x] `JurisprudenceSection` frontend component live (DONE)
- [ ] Verify `searchterms` parameter works reliably end-to-end (test with gemeente filter)
- [ ] Add bestuursrecht/omgevingsrecht filter to search UI (use `subject` parameter)
- [ ] Ruling outcome classification badge via AI on inhoudsindicatie

### Track 3: AI Legal Analysis — Launch With

- [ ] Batch fetch function: given gemeente + rechtsgebied, retrieve N most recent bestuursrecht rulings
- [ ] Claude integration: classify ruling outcome + extract project type + key blocker from inhoudsindicatie
- [ ] Store analysis results in JSONB cache (on AreaScan or a dedicated `JurisprudenceAnalysis` table)
- [ ] "Juridisch klimaat" summary card with succeskans score + key risk factors in `WijkDetailView`
- [ ] Confidence indicator: "Gebaseerd op 12 uitspraken (2022-2025)" for transparency

### Add After Validation (v1.x)

- [ ] CBS scoring contribution to opportunity score — trigger: confirm CBS data improves lead quality
- [ ] Trend analysis: ruling outcomes year-over-year per gemeente — trigger: user asks "is Rotterdam getting stricter?"
- [ ] Frequent appellant detection — trigger: user reports missing "who objects" context

### Future Consideration (v2+)

- [ ] Weekly AI ruling digest for monitored gemeenten — complex notification infrastructure
- [ ] CBS multi-year WOZ trend comparison — multi-dataset fetch and join
- [ ] Cross-gemeente legal risk benchmarking — "Amsterdam vs Rotterdam vs Utrecht juridisch klimaat"

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CBS metrics display card (UI only) | HIGH | LOW | P1 |
| CBS OData v4 migration + dataset update | HIGH | LOW | P1 |
| Omgevingsrecht search filter in UI | MEDIUM | LOW | P1 |
| Ruling outcome classification badge | HIGH | MEDIUM | P1 |
| AI juridisch klimaat summary | HIGH | HIGH | P1 |
| Vergunnings-succeskans score | HIGH | HIGH | P2 |
| CBS dataset freshness indicator | LOW | LOW | P2 |
| CBS scoring contribution to opportunity score | MEDIUM | MEDIUM | P2 |
| Frequent appellant detection | MEDIUM | HIGH | P3 |
| CBS multi-year trends | MEDIUM | HIGH | P3 |
| Weekly ruling digest notifications | LOW | HIGH | P3 |

---

## API Characteristics (Verified Live 2026-03-06)

### CBS OData v4

- **Current v3 URL in codebase:** `https://opendata.cbs.nl/ODataApi/OData/{dataset_id}/TypedDataSet`
- **Target v4 URL:** `https://datasets.cbs.nl/odata/v1/CBS/{dataset_id}/Observations`
- **Latest 2024 dataset:** `85984NED`; Latest 2025 dataset: `86165NED`
- **Region filter:** OData `$filter=WijkenEnBuurten eq 'WK036300'` (wijk) or `'GM0363    '` (gemeente — note trailing spaces in CBS keys)
- **Key measure codes verified (dataset 85984NED):**
  - `M001642` — Gemiddelde WOZ-waarde van woningen
  - `ST0001` — Mate van stedelijkheid (1=zeer sterk stedelijk, 5=niet stedelijk)
  - `ST0003` — Omgevingsadressendichtheid (addresses/km²)
  - `T001036` — Aantal inwoners
  - `M000297` — Woningvoorraad
  - `1014800` — Koopwoningen
  - `1014850_2` — Huurwoningen totaal
  - `M000100` — Bevolkingsdichtheid
  - `M000223` — Gemiddeld inkomen per inkomensontvanger
  - `ZW10290` — Percentage eengezinswoning
  - `ZW10340` — Percentage meergezinswoning
  - `M000114` — Gemiddelde huishoudensgrootte
- **Rate limits:** None documented; public open data API
- **Coverage:** ~100% for wijken, ~60-80% for buurten (sub-wijk level)

### Rechtspraak Open Data

- **Search endpoint:** `https://data.rechtspraak.nl/uitspraken/zoeken`
- **Parameters verified:** `searchterms`, `max`, `sort` (ASC/DESC), `type` (Uitspraak/Conclusie), `date`, `subject` (rechtsgebied URI), `creator` (court filter)
- **Bestuursrecht subject URI:** `http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht`
- **Content endpoint:** `https://data.rechtspraak.nl/uitspraken/content?id=ECLI:NL:RVS:...`
- **Response format:** Atom XML (search), Open Rechtspraak XML (document)
- **Key XML fields confirmed in ECLI:NL:RVS:2024:2049:**
  - `dcterms:identifier` — ECLI identifier
  - `dcterms:creator` — Court name (e.g., "Raad van State")
  - `dcterms:date` — Ruling date
  - `psi:procedure` — Procedure type (e.g., "Hoger beroep")
  - `dcterms:subject` — Rechtsgebied URI
  - `dcterms:relation` — Formal relations to other cases
  - `inhoudsindicatie` — 2-4 sentence summary (AI analysis input)
  - `uitspraak` — Full ruling text
- **Rate limit:** 10 requests/second; semaphore (value=5) already implemented in codebase
- **Corpus size verified live:** 3,573,904 rulings total as of 2026-03-06
- **Key limitation:** `searchterms` searches title metadata only, NOT full document text

### AI Legal Analysis (Claude)

- **Pattern:** Claude already integrated in app for bestemmingsplan PDF parsing via ARQ worker
- **Cost-efficient approach:** Use `inhoudsindicatie` (100-300 chars) for classification, NOT full `uitspraak` (too long, expensive)
- **Recommended models:** `claude-haiku-3-5` for per-ruling classification; `claude-sonnet-4-5` for synthesis
- **Input per ruling:** ~500 tokens (inhoudsindicatie + classification prompt)
- **Synthesis input:** 10-20 classified rulings → juridisch klimaat summary
- **Output structure per ruling:** `{outcome: "verleend|geweigerd|deels|overig", project_type: str, key_factor: str}`
- **Synthesis output:** succeskans score + top 2-3 risk factors + verdeling van uitspraken

---

## User Journey

### Journey 1: CBS Neighborhood Screening (Discovery)

1. User opens `WijkDetailView` for "Spoorzone Tilburg"
2. Sees `NeighborhoodMetricsCard`: WOZ €285k gemiddeld, Sterk stedelijk (klasse 2), 68% koopwoningen, inkomen €42k
3. Compares against a neighboring wijk — "Centrum Tilburg is more urban but WOZ €310k, better demand signal"
4. Combines with opportunity score to prioritize scan results in the most promising market context

### Journey 2: Jurisprudence Research (Due Diligence)

1. User has a church in Breda they are evaluating for residential conversion
2. Opens WijkDetailView → JurisprudenceSection → default query "omgevingsvergunning Breda"
3. Applies bestuursrecht filter, sets to DESC (newest first)
4. Reads 3 rulings from last 2 years — two approved church conversions, one rejected for monument reasons
5. Clicks on a ruling to open it — reads the inhoudsindicatie and key consideration: "Raad van State confirms monument status alone does not prevent residential reuse if heritage value is preserved"
6. Saves insight before consulting their lawyer — due diligence reduced from days to minutes

### Journey 3: AI Risk Assessment (Go/No-Go Support)

1. User is at final feasibility stage for a large residential project in Rotterdam
2. Clicks "Analyseer juridisch klimaat" on the WijkDetailView
3. Platform fetches last 2 years of bestuursrecht rulings for Rotterdam, sends inhoudsindicatoren to Claude
4. Returns card: "Juridisch klimaat: Matig gunstig (67% succeskans). Gebaseerd op 14 uitspraken 2023-2025. Aandachtspunt: 4 zaken geblokkeerd door VvE-bezwaar bij kantoor-naar-wonen transformaties."
5. User sees a risk factor they were not aware of — adjusts project design to avoid VvE complications before starting the permit process

---

## Competitor Feature Analysis

| Feature | Spartner NL | Transect US | Propdex Approach |
|---------|-------------|-------------|-----------------|
| Neighborhood stats | WOZ from Waardeloket only | US market data (not NL) | CBS OData with 10 curated PropTech-relevant fields |
| Court rulings / legal precedent | Not present | US-focused legal data | Rechtspraak full integration — unique in NL PropTech |
| AI legal analysis | Not present | Basic zoning summaries | Claude-powered Dutch legal precedent synthesis — first-mover |
| Jurisprudence search UI | Not present | Not applicable | Live search with split-pane document viewer |
| Risk scoring from legal data | Not present | Not applicable | Vergunnings-succeskans from ruling outcome corpus |

Propdex is first-mover in NL PropTech for court ruling intelligence. No NL competitor combines CBS neighborhood context with Rechtspraak legal precedent analysis in a single workflow.

---

## Sources

- CBS OData v4 API base URL: `https://datasets.cbs.nl/odata/v1/CBS/` — [CBS Quick Start Guide](https://www.cbs.nl/en-gb/our-services/open-data/statline-as-open-data/quick-start-guide)
- CBS measure codes verified live via API call to `https://datasets.cbs.nl/odata/v1/CBS/85984NED/MeasureCodes`
- CBS dataset 85984NED (2024): [CBS Kerncijfers wijken en buurten 2024](https://www.cbs.nl/nl-nl/cijfers/detail/85984NED)
- CBS 2025 dataset 86165NED: [CBS Kerncijfers wijken en buurten 2025](https://www.cbs.nl/nl-nl/cijfers/detail/86165NED)
- CBS variable documentation (PDF): [Toelichting variabelen KWB 2024](https://www.cbs.nl/-/media/_pdf/2024/35/toelichting-variabelen-kwb-2024.pdf)
- Rechtspraak search endpoint verified live: `https://data.rechtspraak.nl/uitspraken/zoeken` (3,573,904 rulings as of 2026-03-06)
- Rechtspraak document XML structure verified: ECLI:NL:RVS:2024:2049 fetched and parsed
- Rechtspraak open data: [Open Data van de Rechtspraak](https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx)
- Wetsuite API documentation (search parameters): [wetsuite.datacollect.rechtspraaknl](https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html)
- Codebase verified: `backend/app/government_apis/cbs_odata.py`, `backend/app/government_apis/rechtspraak.py`, `backend/app/api/endpoints/jurisprudence.py`, `frontend/src/components/projects/JurisprudenceSection.tsx`, `frontend/src/hooks/useJurisprudence.ts`

---

*Feature research for: Propdex v11.0 Open Data Intelligence*
*Researched: 2026-03-06*
