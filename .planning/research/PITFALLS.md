# Domain Pitfalls: v13.0 Juridisch Klimaat Intelligence

**Domain:** Legal intelligence for Dutch PropTech platform (court ruling analysis, geo-contextualization, procedure duration)
**Researched:** 2026-03-07
**Context:** Adding deep Rechtspraak API integration, geo-contextualization of court rulings, doorlooptijd-analyse, bekendmakingen cross-reference, and Explorer UI to existing Propdex platform (v11.0 has basic search + AI analysis)
**Overall confidence:** HIGH -- most pitfalls verified against existing codebase, Rechtspraak API documentation, and known issues from current implementation

---

## Critical Pitfalls

Mistakes that cause rewrites, garbage data, or fundamentally broken legal intelligence.

### Pitfall 1: Rechtspraak Search API Has No Location Filter -- ECLI Prefix is the Only Viable Approach

**What goes wrong:** Developers assume the Rechtspraak search API (`data.rechtspraak.nl/uitspraken/zoeken`) supports a location or gemeente filter. It does not. The `searchterms` parameter is full-text only. Searching for "omgevingsvergunning Venlo" returns results that mention Venlo anywhere in the text, but also returns thousands of unrelated results. The current implementation already suffers from this: `defaultSearch = "omgevingsvergunning ${gemeenteNaam}"` produces irrelevant results because the gemeente name is often absent from the title, summary, and sometimes even the ruling text.

**Why it happens:** The API is designed for legal researchers searching by legal concept, not by geographic area. The `spatial` metadata field exists in some responses but is not a queryable search parameter. There is no `gemeente` or `location` filter parameter in the API.

**Consequences:** AI analysis runs on garbage input (irrelevant rulings) and produces garbage output (wrong klimaat score). Users see rulings from other parts of the country mixed in with local ones. The entire juridisch klimaat feature loses credibility.

**Prevention:**
- **Use ECLI court code prefix filtering as the primary geo-scoping strategy.** Dutch ECLI format: `ECLI:NL:{COURT_CODE}:{YEAR}:{ID}`. Court codes map to arrondissementen (judicial districts):
  - RBLIM = Rechtbank Limburg (covers Venlo, Maastricht, Roermond)
  - RBAMS = Rechtbank Amsterdam
  - RBGEL = Rechtbank Gelderland (covers Arnhem, Nijmegen, Zutphen)
  - RBROT = Rechtbank Rotterdam
  - RBNHO = Rechtbank Noord-Holland (covers Haarlem, Alkmaar)
  - RBMNE = Rechtbank Midden-Nederland (covers Utrecht, Amersfoort, Lelystad)
  - RBOVE = Rechtbank Overijssel (covers Almelo, Zwolle)
  - RBNNE = Rechtbank Noord-Nederland (covers Groningen, Leeuwarden, Assen)
  - RBOBR = Rechtbank Oost-Brabant (covers 's-Hertogenbosch, Eindhoven)
  - RBZWB = Rechtbank Zeeland-West-Brabant (covers Breda, Middelburg)
  - RBDHA = Rechtbank Den Haag
  - RVS = Raad van State (national, handles omgevingsrecht appeals)
- Build a `gemeente_to_court_code` mapping table (342 gemeenten -> 11 rechtbanken). This is a static dataset that changes only on judicial reorganization (last one: 2013).
- Filter search results by ECLI prefix **after** the API call, or use the `instantie` API parameter if available.
- Always include RVS (Raad van State) results for omgevingsrecht -- these are the definitive appeal rulings regardless of location.

**Detection:** Count what percentage of returned rulings actually mention the target gemeente in their text. If < 30%, the search is too broad.

**Confidence:** HIGH -- verified against current implementation behavior and Rechtspraak API documentation. The MEMORY note confirms "Rechtspraak API levert landelijke resultaten, geen locatie-filter" and "ECLI prefix filtering (bijv. RBLIM = Limburg) is de beste optie."

### Pitfall 2: Geo-Contextualization NLP on Dutch Legal Text is Harder Than It Looks

**What goes wrong:** Extracting location (gemeente, address, postcode) from Dutch court ruling text appears straightforward but fails in practice because:
1. **Anonymization:** Rechtspraak anonymizes rulings. Street addresses are replaced with `[adres]` or `[locatie]`. Personal names become `[appellant]`.
2. **Legal naming conventions:** Rulings refer to "het college van burgemeester en wethouders van Venlo" (the board of mayor and aldermen of Venlo), not just "Venlo". Simple substring matching misses these.
3. **Multi-gemeente rulings:** A single ruling may mention multiple gemeenten (e.g., comparing policy between gemeenten, or an appeal about a location near a border).
4. **Historical names:** Older rulings use pre-herindeling gemeente names (e.g., "Horst aan de Maas" was "Horst" before 2001).
5. **Naming ambiguity:** "Bergen" is both a gemeente in Noord-Holland and one in Limburg. "Haarlem" appears in addresses outside Haarlem.

**Why it happens:** Legal text is not like news articles. The anonymization policy (since ~2014) specifically removes the geographic identifiers that would make extraction easy. The "gemeente" that matters is often the respondent party ("verweerder: het college van B&W van [gemeente]"), not a location mentioned in passing.

**Consequences:** False positives (ruling tagged to wrong gemeente), false negatives (relevant ruling missed because location was anonymized), and confusing results where the same ruling appears under multiple gemeenten.

**Prevention:**
- **Two-pass extraction strategy:**
  1. **Metadata pass (fast, reliable):** Extract court code from ECLI (maps to arrondissement). Extract "instantie" (creator) field. Extract "spatial" metadata field if present (not always populated). This gives you the judicial district reliably.
  2. **Text pass (slower, supplementary):** Regex patterns for "college van burgemeester en wethouders van {gemeente}", "gemeente {naam}", "omgevingsvergunning {adres}", postcode patterns (4 digits + 2 letters). Use Claude for ambiguous cases only.
- **Do NOT use spaCy NER for gemeente extraction.** Dutch spaCy models (nl_core_news_lg) recognize GPE entities but perform poorly on municipality names in legal context. The training data is news articles, not court rulings. Claude with a targeted prompt will outperform spaCy for this specific task.
- **Accept arrondissement-level precision as the baseline.** ECLI prefix gives you the court district (covers 20-50 gemeenten). Full-text extraction narrows it further but will never be 100% accurate due to anonymization. This is still massively better than the current "everything nationwide" approach.
- **Build a known-gemeente lookup set** (342 current + ~100 historical names) and match against it, not open-ended NER.
- **Handle multi-gemeente rulings** by tagging with primary gemeente (respondent/verweerder party) and secondary mentions.

**Detection:** Manually review 50 rulings from a single gemeente. If fewer than 70% are correctly geo-tagged, the extraction logic needs tuning.

**Confidence:** HIGH -- anonymization policy is well-documented by Rechtspraak. The pattern "college van B&W van {gemeente}" as the primary extraction target is verified against sample rulings.

### Pitfall 3: AI Analysis on Irrelevant Input Produces Confidently Wrong Output

**What goes wrong:** The current implementation sends ALL search results (up to 25 ECLIs) to Claude for analysis. Because the search returns irrelevant results (Pitfall 1), Claude confidently analyzes rulings that have nothing to do with the target gemeente. The resulting `juridisch_klimaat_score` and `vergunnings_succeskans` are meaningless numbers based on random national rulings presented as local intelligence.

**Why it happens:** Claude does not know whether a ruling is geographically relevant to the target gemeente. It analyzes whatever it receives and produces a plausible-sounding analysis. The prompt says "analyseer rechtspraak voor een gemeente" but the input contains rulings from unrelated locations.

**Consequences:** Users make investment decisions based on a "juridisch klimaat" score that reflects national trends, not local reality. A gemeente with a hostile planning department gets a favorable score because unrelated favorable rulings from other regions dilute the signal. This is worse than having no feature at all -- it creates false confidence.

**Prevention:**
- **Fix the input pipeline before fixing the AI analysis.** Pitfall 1 (ECLI filtering) and Pitfall 2 (geo-contextualization) MUST be resolved in earlier phases before the AI analysis phase runs.
- **Add a relevance pre-filter:** After geo-filtering, verify each ruling mentions the target gemeente or is from the correct arrondissement before including it in the AI batch.
- **Reduce the batch size for AI analysis.** Analyzing 5-8 highly relevant rulings produces better intelligence than analyzing 25 weakly relevant ones. Quality over quantity.
- **Add input quality metrics to the AI response:** Include `"input_relevance": "HIGH/MEDIUM/LOW"` based on how many rulings actually mention the target gemeente. Surface this to the user.
- **Never show klimaat score without stating the sample:** "Gebaseerd op 7 uitspraken Rechtbank Limburg (2022-2025)" is honest. "Juridisch klimaat score: 72" without context is misleading.

**Detection:** Compare AI analysis results for the same gemeente with 25 unfiltered results vs. 8 ECLI-filtered results. If the scores differ significantly, the unfiltered version was analyzing noise.

**Confidence:** HIGH -- directly observed in current implementation. MEMORY confirms "Current AI analysis runs on garbage input -> garbage output."

### Pitfall 4: Full-Text Court Ruling Caching Costs Explode Without Size Guards

**What goes wrong:** Court rulings are long documents -- typically 5,000-50,000 characters, some exceeding 100,000 characters. Caching full text in JSONB (current `CachedAPIResponse` pattern) for even 100 rulings per gemeente creates multi-megabyte JSONB columns. With 342 gemeenten and multi-tenant isolation, the `cached_api_responses` table grows to gigabytes rapidly.

**Why it happens:** The existing JSONB cache pattern works well for structured API responses (CBS data = small JSON). Court ruling full text is fundamentally different -- it is unstructured prose, not structured data. Storing it in the same table/pattern is a category error.

**Consequences:** Slow queries on `cached_api_responses` as JSONB columns grow. Expensive `pg_dump` backups. PostgreSQL TOAST compression helps but does not solve the fundamental problem. Eventually, database performance degrades across ALL cached data (not just rulings).

**Prevention:**
- **Separate the ruling text cache from the general JSONB cache.** Create a dedicated `rechtspraak_rulings` table with:
  - `ecli` (TEXT PRIMARY KEY) -- NOT organization-scoped (rulings are public data, shared across tenants)
  - `full_text` (TEXT) -- not JSONB
  - `metadata_json` (JSONB) -- instantie, datum_uitspraak, rechtsgebied
  - `text_length` (INTEGER) -- for monitoring
  - `fetched_at` (TIMESTAMP)
- **Tenant isolation is NOT needed for ruling text.** Court rulings are public documents. Every organization sees the same ruling. Duplicating them per tenant wastes storage.
- **Set a maximum text length for Claude analysis.** Truncate to first 15,000 characters for AI analysis -- the relevant legal reasoning is always in the first section. Store full text for the viewer but send truncated text to Claude.
- **Implement LRU eviction:** Keep the most recently accessed 5,000 rulings. Older rulings can be re-fetched on demand. 5,000 rulings x 30KB average = ~150MB, manageable.

**Detection:** Monitor `cached_api_responses` table size monthly. If it exceeds 500MB, investigate JSONB column sizes.

**Confidence:** HIGH -- based on existing caching architecture and typical ruling text sizes verified from sample Rechtspraak API responses.

---

## Moderate Pitfalls

### Pitfall 5: Rechtspraak API Rate Limit is Per-Second, Not Per-Hour

**What goes wrong:** The current `rechtspraak_limiter` is configured as `max_concurrent=3, max_per_hour=300`. But the actual Rechtspraak API limit is **10 requests per second**, not a per-hour quota. The existing limiter is more conservative than necessary for normal use, but during a batch fetch of 25 ruling documents (the analysis job), all 25 sequential fetches go through the same limiter. At 3 concurrent, this takes ~9 seconds minimum for the HTTP requests alone.

More critically, the per-second limit means that parallel processing (e.g., fetching rulings for multiple gemeenten simultaneously across different users/tenants) can exceed 10 req/s if the hourly limiter has budget remaining.

**Prevention:**
- **Replace the hourly limiter with a per-second token bucket** for Rechtspraak specifically. Use `AsyncLimiter(max_rate=8, time_period=1)` (leaving 2 req/s headroom below the 10/s limit).
- **Batch document fetches with concurrency control:** For the analysis job, fetch up to 5 documents concurrently (asyncio.gather with semaphore) instead of sequentially. This reduces a 25-document fetch from ~25 seconds to ~5 seconds.
- **Keep the concurrent request limit at the semaphore level** to prevent bursts exceeding the per-second limit.

**Detection:** 429 Too Many Requests responses from the Rechtspraak API. Log these prominently.

**Confidence:** HIGH -- "10 requests/calls per second" is explicitly documented on the Rechtspraak Open Data page.

### Pitfall 6: Doorlooptijd-Analyse Requires Dates That Are Often Missing

**What goes wrong:** Calculating procedure duration ("doorlooptijd") requires at least two dates: filing date and ruling date. The Rechtspraak API provides `datum_uitspraak` (ruling date) reliably, but `datum_indiening` (filing date) is NOT in the standard metadata. The "date" field in the Atom feed (`<updated>`) is the publication date, not the case start date.

To calculate doorlooptijd, you need dates from the ruling TEXT itself (e.g., "het beroep is ingediend op 15 maart 2023") or from the linked bekendmaking (vergunning aanvraag datum). This requires text extraction, which is unreliable.

**Consequences:** Doorlooptijd calculations based on incomplete date pairs (e.g., using publication date as a proxy for filing date) produce inaccurate results. Publication can happen weeks to months after the ruling, and filing can happen months before.

**Prevention:**
- **Start with what is reliable:** Calculate `days_from_ruling_to_publication = datum_publicatie - datum_uitspraak`. This is available from metadata and gives users a sense of court processing speed.
- **For actual procedure duration:** Extract dates from ruling text using targeted regex: `"het beroep is ingediend op {date}"`, `"het bezwaar is gemaakt op {date}"`, `"het verzoek is ontvangen op {date}"`. These patterns are formulaic in Dutch administrative law rulings.
- **Never show doorlooptijd as a single number without confidence:** If both dates are extracted from text, show "~14 maanden (geschat uit tekst)". If only ruling date is available, show "Doorlooptijd onbekend" rather than a wrong number.
- **Aggregate cautiously:** For the gemeente-level "gemiddelde doorlooptijd", only include rulings where both dates were extracted with high confidence. Show the sample size: "Gemiddelde doorlooptijd: 11 maanden (n=12 zaken)".

**Detection:** If more than 50% of rulings lack a filing date, the doorlooptijd feature should degrade gracefully to "onvoldoende data" rather than showing averages based on tiny samples.

**Confidence:** MEDIUM -- `datum_uitspraak` availability verified in API responses. Filing date extraction from text needs empirical validation on a sample of 50+ rulings.

### Pitfall 7: Bekendmakingen Cross-Reference Has No Shared Identifier

**What goes wrong:** Developers assume there is a foreign key or shared identifier between a Rechtspraak ruling and the corresponding SRU bekendmaking (vergunning publication). There is none. A court ruling about a vergunning in Venlo and the original vergunning bekendmaking in the SRU feed are in completely separate systems with no linking mechanism.

**Why it happens:** The Rechtspraak system and the SRU Bekendmakingen system are maintained by different government organizations (Raad voor de Rechtspraak vs. KOOP/Overheid.nl). They do not share databases or identifiers.

**Consequences:** Building a "click ruling -> see original vergunning on map" feature requires fuzzy matching (address, date range, project description). This matching is unreliable and expensive to compute. Users expect precision but get probabilistic matches.

**Prevention:**
- **Downscope the cross-reference feature to "best effort" with explicit uncertainty.** Show "Mogelijk gerelateerde bekendmaking" (possibly related publication), not "Bijbehorende vergunning" (corresponding permit).
- **Match on three signals combined:**
  1. Same gemeente (from geo-contextualization)
  2. Overlapping date range (bekendmaking date within 2 years before ruling date)
  3. Text similarity (address or project description extracted from ruling matched against bekendmaking title/content)
- **Make this a Phase 2 feature, not Phase 1.** The core juridisch klimaat intelligence (ECLI filtering, geo-contextualization, AI analysis) delivers value without bekendmakingen cross-reference. Adding fuzzy matching increases scope significantly.
- **Consider ARQ background job for matching** -- do not attempt this at request time.

**Detection:** Measure match rate and precision on a sample of 50 rulings where you manually identify the corresponding bekendmaking. If precision < 60%, the feature should not ship.

**Confidence:** MEDIUM -- no shared identifier confirmed via investigation of both API systems. The feasibility of fuzzy matching needs empirical validation.

### Pitfall 8: Explorer UI Filter Combinatorics Cause Empty Results

**What goes wrong:** Building a filter UI with scope (gemeente/arrondissement/landelijk), case type (omgevingsvergunning, bestemmingsplan, milieu), outcome (toegewezen/afgewezen/gedeeltelijk), and time period creates a combinatorial space where most filter combinations return zero results. A small gemeente might have only 3 omgevingsrecht rulings in the last 5 years. Filtering further by outcome and type leaves nothing.

**Consequences:** Users think the feature is broken when they see "Geen resultaten" after applying reasonable filters. They lose trust in the data completeness.

**Prevention:**
- **Show result counts on filter options BEFORE applying them.** Display "Omgevingsvergunning (12)" vs "Bestemmingsplan (3)" so users see what is available.
- **Use progressive filtering, not simultaneous.** Apply filters one at a time and update counts. Do not let users set 4 filters at once and get zero results.
- **Default to arrondissement scope, not gemeente.** A rechtbank arrondissement covers 20-50 gemeenten, providing a much larger pool of relevant rulings.
- **Show a "broaden your search" suggestion** when results drop below 3: "Verbreed naar arrondissement Limburg (47 resultaten)" or "Verwijder het uitkomst-filter (12 resultaten)".
- **Pre-compute filter counts** for common combinations and cache them. This avoids expensive real-time queries for count badges.

**Detection:** If > 30% of filter interactions result in zero results, the default scope is too narrow.

**Confidence:** HIGH -- this is a general search UI pitfall, amplified by the small number of omgevingsrecht rulings per gemeente.

### Pitfall 9: ARQ Job Creates New DB Engine Per Invocation

**What goes wrong:** The current `jurisprudence_analysis_job` creates a new `create_async_engine()` and `async_sessionmaker()` on every invocation. For a background job that runs infrequently, this is acceptable. But with the v13.0 expansion (batch ECLI fetching, geo-contextualization processing, doorlooptijd extraction), jobs will run more frequently and take longer. Creating and disposing engine+pool per invocation adds overhead and can hit PostgreSQL `max_connections` under concurrent load.

**Prevention:**
- **Pass the session factory through the ARQ context** (set up in `startup()` / `shutdown()` hooks of the worker). The ARQ worker already supports a `ctx` dict -- store `session_factory` there instead of creating it per job.
- This pattern is already used by some other ARQ jobs in the codebase. Align the jurisprudence job with the established pattern.
- Ensure the ARQ worker's engine is configured with appropriate pool size for the expected concurrency.

**Detection:** PostgreSQL `pg_stat_activity` showing many short-lived connections from the worker process.

**Confidence:** HIGH -- verified in current `jurisprudence_analysis.py` code (lines 46-58).

### Pitfall 10: Claude Token Budget Explosion With Full Ruling Texts

**What goes wrong:** The current analysis job sends full ruling texts to Claude. A single ruling can be 30,000-100,000 characters (~7,500-25,000 tokens). Sending 10 rulings = 75,000-250,000 input tokens per analysis request. At Claude Sonnet pricing, this is $0.22-$0.75 per analysis. With multiple gemeenten per user session and multiple users, costs scale rapidly.

**Consequences:** High API costs per analysis. Slow response times (large context = slower inference). Risk of hitting Claude's context window limit (200K tokens) with just a few large rulings.

**Prevention:**
- **Truncate ruling texts before sending to Claude.** The legally relevant sections (OVERWEGINGEN / BEOORDELING) are typically in the first 5,000-10,000 characters. The procedural history and party listing at the start can be stripped.
- **Extract sections using structural markers.** Dutch rulings follow a consistent structure: PROCESVERLOOP (procedure history) -> OVERWEGINGEN (considerations) -> BESLISSING (decision). Extract only OVERWEGINGEN and BESLISSING.
- **Set a hard maximum of 60,000 input tokens per analysis request.** If the combined texts exceed this, reduce the batch size or truncate more aggressively.
- **Use a two-stage approach:** First pass: Claude analyzes each ruling individually with truncated text (cheaper, parallel). Second pass: Claude synthesizes per-ruling analyses into a gemeente-level klimaat score (small input, fast).
- **Track token usage per analysis in the job record** for cost monitoring.

**Detection:** Monitor Claude API costs per job. If average cost per analysis exceeds $0.30, investigate input sizes.

**Confidence:** HIGH -- based on typical ruling lengths observed in Rechtspraak API responses and Claude pricing.

---

## Minor Pitfalls

### Pitfall 11: ECLI Court Code Covers Multiple Gemeenten -- Users Expect Precision

**What goes wrong:** Filtering by ECLI court code (e.g., RBLIM) returns rulings from the entire arrondissement (Limburg = ~30 gemeenten). Users searching for "Venlo" see rulings about Maastricht, Roermond, Heerlen, etc. This is a significant improvement over national results but still broader than expected.

**Prevention:**
- **Set expectations in the UI:** "Uitspraken Rechtbank Limburg (arrondissement Venlo)" not "Uitspraken Venlo".
- **Apply geo-contextualization (Pitfall 2) as a secondary filter** to narrow from arrondissement to gemeente where possible.
- **Sort by relevance:** Rulings that mention the specific gemeente first, then other rulings from the same arrondissement.

**Confidence:** HIGH -- inherent limitation of the ECLI structure.

### Pitfall 12: Raad van State Rulings Are National But Locally Relevant

**What goes wrong:** Raad van State (RVS) handles ALL omgevingsrecht appeals nationally. These rulings have ECLI prefix `RVS`, not a regional court code. Filtering only by regional court codes (RBLIM, RBAMS, etc.) misses all appeal rulings, which are often the most important for understanding legal precedent.

**Prevention:**
- **Always include RVS rulings in addition to regional court rulings.**
- **For RVS rulings, geo-contextualization (text extraction) is the only way to determine relevance** to a specific gemeente.
- **Prioritize RVS rulings in the UI** -- appeal court decisions carry more legal weight than first-instance rulings.

**Confidence:** HIGH -- structural feature of the Dutch judicial system.

### Pitfall 13: Search Cache Key Based on ECLI List Hash Breaks With New Filters

**What goes wrong:** The current cache key for AI analysis is `ai_juridisch:{org_id}:{sha256(sorted_ecli_list)}`. When the v13.0 Explorer adds filters (date range, case type, outcome), the ECLI list changes per filter combination. This means every filter change triggers a new (expensive) AI analysis, even if 90% of the ECLIs overlap with a previous analysis.

**Prevention:**
- **Cache AI analysis per-ruling, not per-batch.** Store individual `RulingAnalysis` objects keyed by ECLI. The aggregation (klimaat score, succeskans) is a cheap re-computation over cached per-ruling analyses.
- **This also enables incremental analysis:** When new rulings appear, only analyze the new ones and re-aggregate.
- **The per-ruling cache is tenant-agnostic** (rulings are public; analysis results are deterministic given the same prompt version).

**Detection:** High cache miss rate in production. If > 50% of analyze requests trigger new Claude calls, the caching strategy needs revision.

**Confidence:** HIGH -- directly observed from the current cache key design in the codebase.

### Pitfall 14: Dutch Legal Date Formats are Inconsistent

**What goes wrong:** Ruling texts use multiple date formats: "15 maart 2023", "15-03-2023", "15/03/2023", "2023-03-15". Metadata uses ISO 8601. Bekendmakingen use yet another format. Naive date parsing with a single regex misses variants.

**Prevention:**
- Build a `parse_dutch_date()` utility that handles all variants: full month name (Dutch), DD-MM-YYYY, DD/MM/YYYY, ISO 8601.
- Use `dateutil.parser` as a fallback but be aware it assumes MM-DD-YYYY for ambiguous dates -- force `dayfirst=True` for Dutch dates.
- Always store parsed dates as `date` objects, never as strings.

**Confidence:** HIGH -- standard Dutch text processing issue.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Rechtspraak API deep research | API has no location filter (#1), rate limit is per-second not hourly (#5) | ECLI prefix filtering + per-second token bucket limiter |
| Backend ECLI-filtering redesign | Court code covers 20-50 gemeenten (#11), RVS rulings are national (#12) | Gemeente-to-court mapping + always include RVS + text-based narrowing |
| Geo-contextualization | Anonymized text defeats NLP (#2), multi-gemeente rulings (#2) | Two-pass extraction (metadata + text), known-gemeente lookup set, accept arrondissement as baseline |
| AI analyse upgrade | Garbage in = garbage out (#3), token budget explosion (#10) | Fix input pipeline FIRST, truncate ruling texts, two-stage analysis |
| Doorlooptijd-analyse | Filing date often missing from metadata (#6), date format inconsistency (#14) | Regex extraction from text with confidence, graceful degradation, parse_dutch_date utility |
| Bekendmakingen-koppeling | No shared identifier (#7), fuzzy matching is unreliable | "Mogelijk gerelateerd" framing, three-signal matching, defer to Phase 2 |
| Explorer UI with filters | Combinatorial empty results (#8), cache key breaks with filters (#13) | Progressive filter counts, per-ruling cache, default to arrondissement scope |
| Full-text caching | JSONB column size explosion (#4), same table as structured data | Dedicated `rechtspraak_rulings` table, shared across tenants, LRU eviction |
| ARQ job infrastructure | Engine-per-invocation overhead (#9), concurrent job handling | Session factory in ARQ context, align with established worker pattern |

---

## Integration Pitfalls (Specific to Adding This to Existing Propdex)

### Integration 1: Existing JurisprudenceSection Component State Reset

**What goes wrong:** The current `JurisprudenceSection` manages `analysisJobId`, `searchTerm`, and `selectedEcli` as local state. Adding Explorer filters, doorlooptijd display, and bekendmakingen links will balloon this component beyond 300 lines (already at 302) and create tangled state dependencies.

**Prevention:**
- **Refactor to a `useJuridischKlimaatState` custom hook** that encapsulates all state (search term, filters, selected ruling, analysis job, view mode).
- **Split the component:** `JuridischKlimaatExplorer` (filter bar + feed), `RulingDetailPanel` (document viewer + AI summary), `KlimaatSummaryCard` (aggregated score + trend).
- **Use URL state for filter persistence** via TanStack Router search params (existing pattern in `/resultaten` route).

**Confidence:** HIGH -- component already at line limit, verified in codebase.

### Integration 2: CachedAPIResponse Table Mixing Structured and Unstructured Data

**What goes wrong:** The `cached_api_responses` table currently stores CBS data (small JSONB), DSO data (medium JSONB), and AI analysis results (medium JSONB). Adding full ruling texts (large TEXT) to the same table creates performance issues for queries that only need structured data.

**Prevention:** Already addressed in Pitfall 4. Create a dedicated `rechtspraak_rulings` table. Keep AI analysis results in `cached_api_responses` but move ruling text out.

**Confidence:** HIGH -- table design verified in codebase.

### Integration 3: Three-State Contract Mismatch Between Search and Document APIs

**What goes wrong:** The existing three-state contract (return model | None | raise GovernmentAPIError) works for individual document fetches. But the search endpoint returns a list, not a single item. Mixing the two patterns in the geo-contextualization pipeline (search -> filter -> fetch documents -> extract locations) creates ambiguity about what "None" means at each stage.

**Prevention:**
- **Define clear return types for each pipeline stage:**
  - Search: `list[SearchResult]` (empty list = no results, never None)
  - Fetch document: `RulingDocument | None` (None = 404, not found)
  - Geo-extract: `GeoContext | None` (None = could not determine location)
  - AI analyze: `RulingAnalysis` (always returns, confidence may be LOW)
- **Never use `| None` for list-returning operations.** Return empty list instead.

**Confidence:** MEDIUM -- pattern recommendation based on existing codebase conventions.

---

## "Looks Done But Isn't" Checklist for v13.0

- [ ] **ECLI court mapping**: Static `gemeente_to_court_code` dict covers all 342 gemeenten
- [ ] **RVS inclusion**: Every search includes Raad van State results alongside regional court results
- [ ] **Geo-contextualization**: Two-pass extraction (ECLI prefix + text patterns) with known-gemeente lookup
- [ ] **Input quality gate**: AI analysis rejects batches where < 50% of rulings are geo-relevant
- [ ] **Ruling text cache**: Separate table, not CachedAPIResponse JSONB, shared across tenants
- [ ] **Text truncation**: Ruling text truncated to OVERWEGINGEN + BESLISSING before Claude analysis
- [ ] **Token budget**: Hard limit of 60K input tokens per Claude analysis call
- [ ] **Per-ruling cache**: AI analysis cached per-ECLI, aggregation computed from cache
- [ ] **Rate limiter**: Per-second bucket (8/s) replacing per-hour bucket for Rechtspraak
- [ ] **Filter counts**: Explorer shows result count per filter option before applying
- [ ] **Empty result handling**: Graceful "verbreed uw zoekopdracht" when filters return < 3 results
- [ ] **Doorlooptijd confidence**: Only shown when both dates extracted, with sample size
- [ ] **Bekendmakingen link**: "Mogelijk gerelateerd" framing, not "bijbehorend"
- [ ] **Component split**: JurisprudenceSection refactored to < 300 lines with custom hook
- [ ] **ARQ session**: Factory passed through context, not created per job
- [ ] **Date parsing**: `parse_dutch_date()` utility handles all Dutch date variants

---

## Sources

- [Rechtspraak Open Data](https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx) -- rate limit documentation (10 req/s)
- [Rechtspraak ECLI page](https://www.rechtspraak.nl/Uitspraken/Paginas/ECLI.aspx) -- ECLI structure and court codes
- [Dutch court codes complete list](https://www.rechtspraak.nl/Uitspraken/Paginas/Volledige-lijst-Nederlandse-gerechtscodes.aspx) -- all court code to arrondissement mappings
- [Open Rechtspraak API docs](https://openrechtspraak.nl/api_docs) -- third-party API documentation including spatial field
- [Rechtspraak Technical Documentation v1.15 PDF](https://www.rechtspraak.nl/SiteCollectionDocuments/Technische-documentatie-Open-Data-van-de-Rechtspraak.pdf) -- official API specification
- [European e-Justice ECLI](https://e-justice.europa.eu/topics/legislation-and-case-law/european-case-law-identifier-ecli/nl_en) -- ECLI format specification
- [wetsuite rechtspraaknl module](https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html) -- community library documenting API behavior
- [spaCy Dutch models](https://spacy.io/models/nl) -- NER capabilities for Dutch text
- Existing codebase: `backend/app/government_apis/rechtspraak.py`, `backend/app/api/endpoints/jurisprudence.py`, `backend/app/jobs/jurisprudence_analysis.py`, `frontend/src/components/projects/JurisprudenceSection.tsx`
- Project MEMORY notes on juridisch-klimaat-redesign (2026-03-07)

---

*Pitfalls research for: v13.0 Juridisch Klimaat Intelligence -- Rechtspraak API deep integration, geo-contextualization, court ruling analysis, explorer UI*
*Researched: 2026-03-07*
