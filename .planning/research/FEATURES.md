# Feature Landscape: Juridisch Klimaat Intelligence

**Domain:** Legal climate analysis for PropTech real estate due diligence (Netherlands)
**Researched:** 2026-03-07
**Confidence:** MEDIUM -- Rechtspraak API parameter list partially verified via community libs and existing implementation; official PDF technical docs not directly parseable. ECLI structure verified via EU e-Justice portal.

---

## Context: Current State and Problem

The existing implementation searches Rechtspraak Open Data via `data.rechtspraak.nl/uitspraken/zoeken` with a free-text query like "omgevingsvergunning Venlo" and the `subject=omgevingsrecht` filter. Results are national -- there is no location filtering. Users get random rulings from across the country that happen to mention the gemeente name in their text, making the feature effectively unusable for per-municipality due diligence.

The AI analysis (Claude) already works well: per-ruling bezwaargrond/uitkomst/relevantie extraction + aggregated juridisch klimaat score + vergunnings-succeskans. The problem is **garbage-in**: irrelevant rulings produce meaningless scores.

**What exists today:**
- `RechtspraakClient.search_jurisprudence()` -- free-text search + omgevingsrecht filter, returns max 10 results
- `RechtspraakClient.get_jurisprudence_document()` -- full document fetch by ECLI
- AI analysis via ARQ job with polling (JuridischAnalyseJob model)
- `JurisprudenceSection` component with search + document viewer + AI summary badges
- `JuridischKlimaatCard` showing aggregated score + vergunnings-succeskans

**What is broken:**
- Free-text search "omgevingsvergunning Venlo" returns national results that happen to contain "Venlo"
- No court/region filtering
- Only 10 results -- statistically meaningless for "klimaat" analysis
- No date filtering -- mixes 2010 rulings with 2024 rulings
- No caching per gemeente -- every view triggers fresh API + AI calls
- No filtering by case type, outcome, or scope

---

## Table Stakes

Features users expect. Missing = the "juridisch klimaat" feature feels broken.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **ECLI court-code filtering** | Filter by rechtbank arrondissement (e.g., RBLIM for Limburg) so results come from the correct regional court instead of random national matches | Low | Gemeente-to-arrondissement mapping table |
| **Date range filtering** | Search rulings within a time window (last 2/5/10 years) so results are temporally relevant | Low | Rechtspraak API `date` param (sd/ed format) |
| **Gemeente jurisprudentie feed** | Auto-populated chronological list of recent omgevingsrecht rulings for a specific gemeente, replacing manual search | Med | ECLI filtering + date sorting + per-gemeente caching |
| **Increased result volume** | 25-50 results minimum for statistical significance; current 10 is meaningless for "klimaat" scoring | Low | Bump `max` parameter, handle pagination |
| **Per-gemeente caching** | Cache search results + AI analysis per gemeente with 7-day TTL. Repeated views must be instant, not trigger fresh API+AI calls | Med | CachedAPIResponse (already exists), new cache key scheme |
| **Uitkomst filtering** | Filter visible rulings by outcome (toegewezen/afgewezen/gedeeltelijk). Users want to see only losses or only wins | Low-Med | Already have uitkomst data from AI, needs filter UI |
| **Win/loss ratio display** | Show aggregate win/loss/partial percentages as summary statistic above the ruling list | Low | Simple computation from AI analysis results |

## Differentiators

Features that set the product apart. Not expected but high-value for vastgoedontwikkelaars.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| **Juridisch Klimaat Explorer** | Full filtering UI: scope (landelijk/provinciaal/gemeentelijk court level), case type (dakopbouw/nieuwbouw/functiewijziging/sloop), outcome, time period. Transforms raw search dump into an actionable decision tool | Med-High | All table stakes features |
| **Vergunningstype classification** | Categorize each ruling by construction type: dakopbouw, nieuwbouw, uitbreiding, functiewijziging, sloop, bestemmingsplanwijziging. Answers "hoe gaat het hier met dakopbouwen?" | Med | Extend AI prompt to extract case type from ruling text |
| **Doorlooptijd-analyse** | Calculate average procedure duration per gemeente per vergunningstype. Answers "hoe lang duurt een bezwaarprocedure hier?" -- critical for project timeline planning | Med | Extract datum bezwaar + datum uitspraak from ruling metadata/text |
| **Geo-contextualisatie via AI** | Extract gemeente/wijk/straat from ruling body text to confirm actual location relevance (especially for Raad van State rulings which have no geographic ECLI code) | Med | AI NER on ruling text, batch-cacheable |
| **Bekendmakingen-koppeling** | Link court rulings to existing SRU bekendmakingen by matching permit/address references. "Bekijk de originele vergunning op de kaart" | High | Text extraction + fuzzy matching against ChangeRecord addresses |
| **Trendlijn per gemeente** | Visual chart showing juridisch klimaat score over time (rolling 12-month windows). "Wordt het hier strenger of soepeler?" | Med | Temporal bucketing of cached rulings |
| **Vergelijkende gemeente analyse** | Compare juridisch klimaat across 2-3 gemeenten side by side for location selection decisions | Low-Med | Existing analysis applied to multiple gemeenten, comparison UI |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full-text search across all rechtsgebieden** | Omgevingsrecht scope is correct for PropTech. Civiel recht, strafrecht etc. create noise without value for development decisions | Keep hardcoded `subject=omgevingsrecht` filter |
| **Own Elasticsearch / full Rechtspraak replica** | Maintaining a full copy of ~500K rulings is massive infra overhead for a startup. Bulk download exists (data.overheid.nl) but ongoing sync is complex | Use the API with smart per-gemeente caching |
| **Real-time ruling notifications** | Court rulings are published irregularly (days to weeks delay). Users check before investment decisions, not daily | Refresh cache on view with stale-while-revalidate pattern |
| **Juridisch advies generation** | Generating legal advice crosses professional liability boundaries. Advocatenwet prohibits giving legal advice without qualification | Always show "indicatief, geen juridisch advies" disclaimer. Analysis = pattern summary, not advice |
| **uitspraken.rechtspraak.nl/api/zoek usage** | This undocumented frontend API has better text search but no guaranteed stability or terms of use | Stick with official `data.rechtspraak.nl` API which is documented and intended for programmatic access |
| **Hoger beroep chain following** | Tracking appeal chains (Rechtbank -> Gerechtshof -> Raad van State) requires complex ECLI cross-referencing and is unreliable in the data | Show rulings from all court levels. Let user see multiple rulings about the same case naturally |
| **Automated location extraction from all rulings in bulk** | Processing 50+ full ruling texts through AI for NER is expensive and slow. Most rechtbank rulings already have geographic ECLI codes | Apply geo-extraction only to Raad van State (RVS) rulings where ECLI has no location. Rechtbank ECLIs already encode the arrondissement |

---

## Rechtspraak API Capabilities (Research Findings)

**Confidence: MEDIUM** -- parameters verified via wetsuite library docs, rechtspraak-extractor PyPI docs, and working implementation. Official technical documentation PDF (v1.15) referenced but not directly parseable.

### Zoeken Endpoint: `data.rechtspraak.nl/uitspraken/zoeken`

Returns an Atom XML feed. Confirmed and potential parameters:

| Parameter | Description | Currently Used | Action |
|-----------|-------------|----------------|--------|
| `searchterms` | Free text query | YES | Keep, make optional when using `instantie` |
| `subject` | Rechtsgebied URI (omgevingsrecht) | YES | Keep hardcoded |
| `max` | Max results per page (reportedly up to ~1000) | YES (10) | Increase to 50 |
| `sort` | ASC/DESC by date | YES | Keep |
| `return` | DOC = only with full text available | YES | Keep |
| `sd` | Start publication date (yyyy-mm-dd) | NO | **Add** -- enables date range filtering |
| `ed` | End publication date (yyyy-mm-dd) | NO | **Add** -- enables date range filtering |
| `from` | Pagination offset for > max results | NO | **Add** -- enables fetching more results |
| `instantie` | Court name/URI filter | NO | **Add** -- KEY for location filtering |
| `type` | Procedure type URI | NO | Consider -- could help case-type pre-filtering |
| `modified` | Changed-since date | NO | Useful for incremental cache refresh |

**Important note on `instantie` parameter:** The technical docs describe this as accepting the court name or URI from the `instantie` value list. Need to verify the exact format (e.g., is it `Rechtbank Limburg` as a string, or a URI like `http://psi.rechtspraak.nl/...`). This requires live API testing.

### Content Endpoint: `data.rechtspraak.nl/uitspraken/content`

Already implemented correctly. Returns full XML with metadata (creator/instantie, issued date) and ruling text (uitspraak/conclusie elements). No changes needed.

### ECLI Structure for Location Filtering

Format: `ECLI:NL:[COURT]:[YEAR]:[ID]`

**Active rechtbanken (11 arrondissementen since 2013):**

| Code | Court | Covers |
|------|-------|--------|
| RBAMS | Rechtbank Amsterdam | Amsterdam gemeente |
| RBDHA | Rechtbank Den Haag | Zuid-Holland, Den Haag e.o. |
| RBGEL | Rechtbank Gelderland | Gelderland |
| RBLIM | Rechtbank Limburg | Limburg |
| RBMNE | Rechtbank Midden-Nederland | Utrecht, Flevoland |
| RBNHO | Rechtbank Noord-Holland | Noord-Holland (excl. Amsterdam) |
| RBNNE | Rechtbank Noord-Nederland | Friesland, Groningen, Drenthe |
| RBOBR | Rechtbank Oost-Brabant | Oost-Brabant |
| RBOVE | Rechtbank Overijssel | Overijssel |
| RBROT | Rechtbank Rotterdam | Rotterdam e.o. |
| RBZWB | Rechtbank Zeeland-West-Brabant | Zeeland, West-Brabant |

**Gerechtshoven (4 ressorten):**

| Code | Court |
|------|-------|
| GHAMS | Gerechtshof Amsterdam |
| GHARL | Gerechtshof Arnhem-Leeuwarden |
| GHDHA | Gerechtshof Den Haag |
| GHSHE | Gerechtshof 's-Hertogenbosch |

**Relevant supreme courts:**

| Code | Court | Note |
|------|-------|------|
| RVS | Raad van State | Most omgevingsrecht appeals end here. **NO geographic ECLI indicator** -- this is the key problem |
| CBB | College van Beroep voor het bedrijfsleven | Some WKB/economic cases |

**Critical insight:** Raad van State (RVS) rulings are the **most relevant** for omgevingsrecht (they handle appeals of gemeente permit decisions) but have **no geographic indicator** in their ECLI. Strategy: use `instantie` parameter to get rechtbank-level rulings for the correct arrondissement, and separately search RVS rulings with text-based gemeente name matching + AI geo-extraction to confirm relevance.

### Gemeente-to-Arrondissement Mapping

Netherlands has 11 arrondissementen since 2013. Each gemeente belongs to exactly one arrondissement. A static mapping table of ~342 gemeenten (2024 count, changes yearly due to herindelingen) to 11 rechtbanken is required.

**Source for mapping:** `rechtspraak.nl/organisatie-en-contact/organisatie/rechtbanken/werk-en-rechtsgebieden-rechtbanken` and `dutchcivillaw.com/jurisdiction/municipalities.htm`.

**Maintenance:** Gemeentelijke herindelingen happen ~annually (usually Jan 1). This is a small maintenance burden -- update the mapping when CBS publishes new gemeente codes.

### Discontinued Court Codes

Pre-2013 rechtbanken were reorganized. Rulings before 2013 use old codes (RBMAA for Maastricht, RBUTR for Utrecht, etc.). The mapping must handle both old and new codes for historical search.

| Old Code | Old Court | Merged Into |
|----------|-----------|-------------|
| RBMAA | Rechtbank Maastricht | RBLIM |
| RBROE | Rechtbank Roermond | RBLIM |
| RBUTR | Rechtbank Utrecht | RBMNE |
| RBARN | Rechtbank Arnhem | RBGEL |
| RBZUT | Rechtbank Zutphen | RBGEL |
| RBHAA | Rechtbank Haarlem | RBNHO |
| RBALK | Rechtbank Alkmaar | RBNHO |
| RBBRE | Rechtbank Breda | RBZWB |
| RBMID | Rechtbank Middelburg | RBZWB |
| RBASS | Rechtbank Assen | RBNNE |
| RBGRO | Rechtbank Groningen | RBNNE |
| RBLEE | Rechtbank Leeuwarden | RBNNE |
| RBSGR | Rechtbank 's-Gravenhage | RBDHA |
| RBSHE | Rechtbank 's-Hertogenbosch | RBOBR |
| RBZLY | Rechtbank Zwolle-Lelystad | RBOVE |
| RBDOR | Rechtbank Dordrecht | RBROT |

---

## Feature Dependencies

```
Gemeente-arrondissement mapping (static table)
  |
  +--> ECLI court-code filtering (instantie param OR ECLI prefix filter)
  |      |
  |      +--> Gemeente jurisprudentie feed (auto-search on gemeente select)
  |      |      |
  |      |      +--> Per-gemeente caching (7-day TTL, keyed by gemeente+date_range)
  |      |      |      |
  |      |      |      +--> Aggregated statistics (win/loss ratio, score)
  |      |      |      |
  |      |      |      +--> Trendlijn per gemeente (temporal bucketing)
  |      |      |
  |      |      +--> Uitkomst filtering (frontend filter on cached data)
  |      |
  |      +--> Date range filtering (sd/ed params)
  |
  +--> Vergunningstype classification (extend AI prompt)
  |      |
  |      +--> Explorer filter by case type
  |      |
  |      +--> Doorlooptijd-analyse (duration per type per gemeente)
  |
  +--> Geo-contextualisatie (AI NER for RVS rulings)
         |
         +--> Bekendmakingen-koppeling (match ruling addresses to ChangeRecords)

All table stakes --> Juridisch Klimaat Explorer (unified filter UI)
All table stakes --> Vergelijkende gemeente analyse
```

### Dependency Notes

- **Gemeente-arrondissement mapping is the foundation.** Everything depends on knowing which rechtbank handles a gemeente. ~342 static entries, changes annually.
- **ECLI filtering and date range are the highest-impact, lowest-effort improvements.** They directly fix the "garbage in" problem.
- **Per-gemeente caching breaks the "every view = API + AI call" pattern.** Current implementation has no gemeente-level cache -- only an ECLI-list hash.
- **AI prompt extensions (vergunningstype, geo-extraction) are independent of each other.** Can be built in parallel.
- **Bekendmakingen-koppeling is the hardest feature.** It requires matching free-text addresses from rulings to geocoded ChangeRecord addresses. Fuzzy matching in Dutch addresses is nontrivial.

---

## MVP Recommendation

### Phase 1 -- Backend Redesign (fix the data quality problem)

1. **Gemeente-to-arrondissement static mapping** -- Python dict of ~342 gemeenten to 11 rechtbank codes (+ old codes for pre-2013). Include CBS gemeente codes for cross-reference.
2. **Add `instantie` and `sd`/`ed` parameters** to `RechtspraakClient.search_jurisprudence()` -- API-level filtering instead of post-filtering.
3. **Dual search strategy**: (a) Search by `instantie` for rechtbank rulings, (b) Search with `searchterms` containing gemeente name for RVS rulings. Merge results.
4. **Increase max results** to 50 (from 10) for meaningful statistics.
5. **Per-gemeente caching** -- new cache key: `rechtspraak:{gemeente_code}:{date_range_hash}` with 7-day TTL. Invalidate on date range change.
6. **Bump AI analysis** to handle 25-50 rulings (current prompt handles arbitrary lists, just increase input).

*Rationale:* All backend changes, minimal frontend impact. Directly fixes the core usability problem.

### Phase 2 -- Explorer UI (make it a real tool)

7. **Vergunningstype classification** -- extend `JURIDISCH_ANALYSE_PROMPT` to extract `type_vergunning` per ruling (dakopbouw/nieuwbouw/functiewijziging/sloop/bestemmingsplanwijziging/overig).
8. **Uitkomst filter chips** -- toggle buttons above ruling list to filter by outcome.
9. **Date range selector** -- dropdown: Laatste 2 jaar / Laatste 5 jaar / Laatste 10 jaar / Alles.
10. **Aggregated statistics bar** -- win/loss/partial percentages + total count + average score.
11. **Two-tab layout**: Tab 1 = Overzicht (statistics + klimaat card + recent rulings), Tab 2 = Explorer (full filter UI).

*Rationale:* Frontend-heavy, builds on cached data from Phase 1. High user-facing value.

### Phase 3 -- Deep Intelligence (differentiators)

12. **Geo-contextualisatie** -- AI NER on RVS ruling text to extract gemeente/location names. Confirm relevance, discard false positives.
13. **Doorlooptijd-analyse** -- extract `datum_bezwaar` and `datum_uitspraak` from ruling metadata, calculate average duration per gemeente per type.
14. **Bekendmakingen-koppeling** -- fuzzy match ruling addresses/permit references to existing SRU ChangeRecords. "Bekijk op kaart" link.

*Rationale:* Higher complexity, needs Phase 1+2 data to be validated first. True differentiators once the basics work.

### Defer

- **Vergelijkende gemeente analyse** -- valuable but not blocking for per-gemeente due diligence. Ship after core flow works.
- **Trendlijn per gemeente** -- requires enough temporal data in cache. Natural follow-up once cache has accumulated data over months.

---

## Complexity Assessment

| Feature | Backend | Frontend | AI | Total | Phase |
|---------|---------|----------|----|-------|-------|
| Arrondissement mapping | Low | - | - | **Low** | 1 |
| API parameter additions (instantie, sd, ed) | Low | - | - | **Low** | 1 |
| Dual search strategy (rechtbank + RVS) | Med | - | - | **Med** | 1 |
| Increase max results + pagination | Low | Low | - | **Low** | 1 |
| Per-gemeente caching | Med | Low | - | **Med** | 1 |
| Vergunningstype classification | Low | Med | Med | **Med** | 2 |
| Uitkomst filter UI | - | Med | - | **Low-Med** | 2 |
| Date range selector | Low | Low | - | **Low** | 2 |
| Aggregated statistics bar | Low | Med | - | **Med** | 2 |
| Two-tab Explorer layout | - | High | - | **Med-High** | 2 |
| Geo-contextualisatie (AI NER) | Med | Low | Med | **Med** | 3 |
| Doorlooptijd-analyse | Med | Med | Med | **Med-High** | 3 |
| Bekendmakingen-koppeling | High | Med | Med | **High** | 3 |

---

## Sources

- [Rechtspraak Open Data](https://www.rechtspraak.nl/Uitspraken/paginas/open-data.aspx) -- official landing page
- [Technical Documentation v1.15 (PDF)](https://www.rechtspraak.nl/SiteCollectionDocuments/Technische-documentatie-Open-Data-van-de-Rechtspraak.pdf) -- authoritative API spec (referenced, not directly parsed)
- [European e-Justice ECLI for NL](https://e-justice.europa.eu/topics/legislation-and-case-law/european-case-law-identifier-ecli/nl_en) -- ECLI court code list, verified
- [ECLI structure (Wikipedia)](https://en.wikipedia.org/wiki/European_Case_Law_Identifier) -- format specification
- [Arrondissementen rechtbanken](https://www.rechtspraak.nl/organisatie-en-contact/organisatie/rechtbanken/werk-en-rechtsgebieden-rechtbanken) -- gemeente-to-court mapping, official source
- [dutchcivillaw.com gemeente-rechtbank mapping](http://www.dutchcivillaw.com/jurisdiction/municipalities.htm) -- complete municipality list
- [wetsuite.datacollect.rechtspraaknl](https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html) -- Python API wrapper, parameter documentation
- [rechtspraak-extractor (PyPI)](https://pypi.org/project/rechtspraak-extractor/) -- sd/ed parameter reference
- [Open Rechtspraak API docs](https://openrechtspraak.nl/api_docs) -- Open State Foundation wrapper
- [Rechterlijke indeling van Nederland](https://nl.wikipedia.org/wiki/Rechterlijke_indeling_van_Nederland) -- judicial district overview
- [GitHub: maastrichtlawtech/extraction_libraries](https://github.com/maastrichtlawtech/extraction_libraries) -- Rechtspraak data extraction patterns
- Existing Propdex codebase: `backend/app/government_apis/rechtspraak.py`, `backend/app/api/endpoints/jurisprudence.py`, `frontend/src/components/projects/JurisprudenceSection.tsx`, `backend/app/ai/prompts.py`

---

*Feature research for: Propdex v13.0 Juridisch Klimaat Intelligence*
*Researched: 2026-03-07*
