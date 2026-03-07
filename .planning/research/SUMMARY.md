# Project Research Summary

**Project:** Propdex v13.0 Juridisch Klimaat Intelligence
**Domain:** Legal climate analysis for PropTech real estate due diligence (Netherlands)
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

Propdex v13.0 transforms the existing (broken) jurisprudence feature into a genuine legal intelligence tool for real estate developers. The current implementation searches Rechtspraak Open Data nationally using free-text queries, producing irrelevant results that feed into AI analysis -- creating confidently wrong juridisch klimaat scores. The fix is architectural: use ECLI court-code prefix filtering to scope results to the correct arrondissement, cache rulings in a dedicated PostgreSQL table (public data, shared across tenants), and layer geo-contextualization on top to narrow from arrondissement (~30 gemeenten) to individual gemeente level.

The recommended approach requires zero new dependencies. Everything builds on existing stack: httpx for Rechtspraak API, lxml for XML parsing, anthropic for AI analysis, ARQ for background jobs, and PostgreSQL for ruling cache. The key new artifacts are a static gemeente-to-rechtbank mapping (342 entries, 11 rechtbanken), a dedicated `ruling_cache` table (org-agnostic, ECLI as primary key), regex-based location extraction from ruling text, and a two-tab frontend (Feed + Explorer). The Rechtspraak API `creator` parameter proved unreliable in live testing (returned 0 results when combined with `subject`), confirming client-side ECLI prefix filtering as the only viable approach.

The primary risks are: (1) geo-contextualization accuracy due to Rechtspraak's anonymization policy replacing addresses with `[adres]`/`[locatie]`, mitigated by accepting arrondissement-level precision as baseline; (2) AI analysis token cost explosion with full ruling texts (30K-100K chars each), mitigated by truncating to OVERWEGINGEN + BESLISSING sections; (3) Explorer filter UI returning empty results for small gemeenten, mitigated by defaulting to arrondissement scope and showing filter counts before applying. The bekendmakingen cross-reference feature should be deferred -- there is no shared identifier between the Rechtspraak and SRU systems, making fuzzy matching unreliable and expensive.

## Key Findings

### Recommended Stack

No new dependencies required. All v13.0 features build on the existing validated stack. The Rechtspraak API is already integrated; this milestone extends it with deeper filtering, caching, and analysis.

**Core technologies (all existing):**
- **httpx + lxml** -- Rechtspraak API HTTP calls and XML parsing (already in use)
- **PostgreSQL dedicated table** -- Ruling cache with indexed columns for court_code, datum_uitspraak, gemeente_naam
- **anthropic + ARQ** -- AI analysis with enhanced prompts, background job for ruling ingestion
- **Python stdlib (re, datetime, statistics)** -- Regex geo-extraction, doorlooptijd calculation, aggregation

**New code modules (not packages):**
- `data/court_mapping.py` -- Static gemeente-to-rechtbank mapping dict (342 gemeenten to 11 rechtbanken + old court codes)
- `services/juridisch_klimaat.py` -- Doorlooptijd aggregation, trend analysis, bekendmakingen linking logic
- `models/ruling_cache.py` -- SQLAlchemy model for cached rulings (no organization_id -- public data)

### Expected Features

**Must have (table stakes):**
- ECLI court-code filtering -- scope results to correct arrondissement instead of national
- Date range filtering -- restrict to last 2/5/10 years via API `date` parameter
- Gemeente jurisprudentie feed -- auto-populated chronological list replacing manual search
- Increased result volume (50 vs current 10) -- statistical significance for klimaat scoring
- Per-gemeente caching with 7-day TTL -- repeated views must be instant
- Win/loss ratio display -- aggregate outcome percentages as summary statistic
- Uitkomst filtering -- filter visible rulings by outcome (toegewezen/afgewezen/gedeeltelijk)

**Should have (differentiators):**
- Juridisch Klimaat Explorer -- multi-filter UI (scope, case type, outcome, period)
- Vergunningstype classification -- categorize rulings by construction type (dakopbouw, nieuwbouw, etc.)
- Doorlooptijd-analyse -- average procedure duration per gemeente per type
- Geo-contextualisatie -- extract gemeente from ruling text for RVS rulings
- Trendlijn per gemeente -- klimaat score over time (rolling 12-month windows)

**Defer (v2+):**
- Bekendmakingen-koppeling -- no shared identifier between Rechtspraak and SRU systems, fuzzy matching unreliable
- Vergelijkende gemeente analyse -- requires core flow working first
- Full Rechtspraak replica / Elasticsearch -- massive infra overhead, API with caching suffices
- Hoger beroep chain following -- unreliable ECLI cross-referencing
- Juridisch advies generation -- professional liability risk (Advocatenwet)

### Architecture Approach

The architecture centers on a `RulingCache` table as the single source of truth -- organization-agnostic (court rulings are public data), ECLI-keyed, with indexed columns for court_code, gemeente, and date. All downstream processing (geo-extraction, doorlooptijd, AI analysis) reads from this cache. The ingestion pipeline runs as a background ARQ job triggered on first gemeente detail open, fetching rulings for the relevant court region(s). The frontend splits into two views: a Feed tab (chronological gemeente-matched rulings, default) and an Explorer tab (multi-filter search with pagination).

**Major components:**
1. **EcliRegistry** -- static gemeente-to-rechtbank mapping, ECLI prefix utilities, old court code translation (pre-2013 codes like RBMAA -> RBLIM)
2. **RulingCache model** -- persistent ruling storage, no org_id, ECLI primary key, indexed for court_code + datum_uitspraak + gemeente SQL queries
3. **RulingIngestion job** -- ARQ background job populating cache per court region, 50 results per search, batch document fetch with concurrency control
4. **GeoContextualizer** -- two-pass extraction: ECLI prefix for arrondissement (reliable), regex for gemeente name from text (supplementary), confidence scoring
5. **DoorlooptijdService** -- procedure duration from ruling metadata dates, graceful degradation when filing dates missing
6. **JurisprudenceFeed + Explorer** -- frontend decomposition of monolithic JurisprudenceSection (currently 302 lines, would balloon to 800+)

### Critical Pitfalls

1. **Rechtspraak API has no location filter** -- ECLI prefix parsing (client-side) is the only viable geo-scoping strategy. The `creator` API parameter returned 0 results when combined with `subject=omgevingsrecht` in live testing. Use two-phase approach: API search with subject+searchterms, then client-side ECLI prefix filter.
2. **AI analysis on irrelevant input produces confidently wrong output** -- Fix the input pipeline (ECLI filtering + geo-contextualization) BEFORE upgrading AI analysis. Current garbage-in-garbage-out is worse than no feature at all. Never show klimaat score without stating the sample size and court.
3. **Geo-contextualization is harder than it looks** -- Rechtspraak anonymizes addresses (`[adres]`, `[locatie]`). Two-pass extraction (ECLI prefix for arrondissement + regex for gemeente name from "college van B&W van {gemeente}" patterns) with known-gemeente validation. Accept arrondissement as baseline precision.
4. **Full-text ruling caching costs explode** -- Rulings are 5K-100K characters. Dedicated table with TEXT column, not JSONB in `cached_api_responses`. Truncate to OVERWEGINGEN + BESLISSING for AI analysis (max 60K input tokens per call). LRU eviction at 5,000 rulings.
5. **Explorer filter combinatorics cause empty results** -- Small gemeenten have few omgevingsrecht rulings. Show filter counts before applying, default to arrondissement scope, suggest broadening when results < 3.

## Implications for Roadmap

Based on combined research, five phases recommended. Ordering follows the data flow: ingest -> enrich -> analyze -> display.

### Phase 1: Ruling Cache + ECLI Court Mapping

**Rationale:** Everything depends on persistent storage and gemeente-to-court mapping. This is the foundation that unblocks all subsequent work. Without it, every other feature continues to operate on garbage data.
**Delivers:** `ruling_cache` table (Alembic migration, no organization_id), `EcliRegistry` module with 342-gemeente mapping + old court code translation, modified `RechtspraakClient` with court-code search + batch document fetch + date range params, ruling ingestion ARQ job with session factory in context.
**Addresses:** ECLI court-code filtering, increased result volume, per-gemeente caching (table stakes)
**Avoids:** Pitfall 1 (no location filter), Pitfall 4 (caching cost explosion), Pitfall 9 (ARQ engine-per-invocation)

### Phase 2: Geo-Contextualization + Feed Endpoint

**Rationale:** With rulings cached, extract location data to narrow from arrondissement to gemeente. This fixes the input quality problem before AI analysis runs on the data. Feed endpoint exposes the enriched data.
**Delivers:** `GeoContextualizer` service (regex extraction + known-gemeente validation), backend feed endpoint (`/api/jurisprudence/feed`), RVS ruling geo-tagging via text extraction, relevance sorting (gemeente mentions first, then arrondissement).
**Addresses:** Gemeente jurisprudentie feed, geo-contextualisatie (differentiator)
**Avoids:** Pitfall 2 (NLP harder than it looks -- use regex not spaCy), Pitfall 3 (garbage-in-garbage-out), Pitfall 11 (arrondissement covers multiple gemeenten), Pitfall 12 (RVS rulings are national)

### Phase 3: AI Analysis Upgrade + Doorlooptijd

**Rationale:** Now that input is filtered and geo-contextualized, the AI analysis produces meaningful results. Doorlooptijd runs in parallel on cached data. Both read from RulingCache without additional API calls.
**Delivers:** Enhanced AI prompt with vergunningstype extraction + geo-context + doorlooptijd, per-ruling analysis caching (not per-batch hash), doorlooptijd calculation from metadata dates with `parse_dutch_date()` utility, token budget controls (60K max, truncate to OVERWEGINGEN + BESLISSING), two-stage analysis (per-ruling then aggregation).
**Addresses:** Vergunningstype classification, doorlooptijd-analyse, win/loss ratio (differentiators + table stakes)
**Avoids:** Pitfall 10 (token budget explosion), Pitfall 6 (missing filing dates -- graceful degradation), Pitfall 13 (cache key breaks with filters -- per-ruling cache), Pitfall 14 (date format inconsistency)

### Phase 4: Explorer UI + Frontend Decomposition

**Rationale:** Backend is complete; build the user-facing Explorer experience. Decompose monolithic JurisprudenceSection into Feed + Explorer + Viewer components (current 302 lines, would balloon to 800+). URL state for filter persistence.
**Delivers:** Two-tab layout (Overzicht/Explorer), filter sidebar (scope, type, uitkomst, period) with counts before applying, progressive filtering, pagination via useInfiniteQuery, "verbreed uw zoekopdracht" suggestions, aggregated statistics bar, `useJuridischKlimaatState` custom hook.
**Addresses:** Juridisch Klimaat Explorer, uitkomst filtering, date range selector (differentiators + table stakes)
**Avoids:** Pitfall 8 (empty filter results -- counts + broadening suggestions), Integration Pitfall 1 (component state explosion -- custom hook extraction)

### Phase 5: Trendlijn + Polish (optional)

**Rationale:** Once cache accumulates data over time, temporal analysis becomes meaningful. Low-risk enhancement phase that can ship independently.
**Delivers:** Rolling 12-month klimaat score trend, CSS-only timeline visualization (no chart library needed for 10-20 data points), rate limiter tuning (per-second bucket replacing per-hour).
**Addresses:** Trendlijn per gemeente (differentiator)

### Phase Ordering Rationale

- **Cache first, then extraction, then AI, then UI** follows the data flow: ingest -> enrich -> analyze -> display. Each phase validates the previous one's output before building on it.
- **Geo-contextualization before AI analysis** is critical -- Pitfall 3 explicitly warns that AI on unfiltered input is worse than no feature. All four research files agree that input quality is the bottleneck, not AI prompt engineering.
- **Frontend last** because backend API changes are the highest-risk, highest-value work. The UI adapts to whatever endpoints exist. Shipping a working backend with the old UI is better than a polished UI on garbage data.
- **Bekendmakingen cross-reference excluded** from all phases -- Pitfall 7 confirms no shared identifier exists between Rechtspraak and SRU systems. This is high-effort, low-reliability work that should not block the core juridisch klimaat overhaul.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Geo-Contextualization):** Anonymization patterns need empirical validation on 50+ sample rulings. Regex false positive rate unknown until tested on real Rechtspraak data. Recommend a spike task early in the phase.
- **Phase 3 (Doorlooptijd):** Filing date availability from ruling metadata needs empirical measurement. If < 50% of rulings have extractable dates, the feature must degrade gracefully to "onvoldoende data" rather than showing unreliable averages.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Cache + Mapping):** Well-documented. ECLI structure is an EU standard. Alembic migration + ARQ job are established patterns in the codebase. Gemeente-to-rechtbank mapping is a static dataset.
- **Phase 4 (Explorer UI):** Standard filter UI patterns. TanStack Query pagination is well-documented. Component decomposition follows existing codebase conventions (MapPanelShell pattern).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All verified against existing codebase + live API testing. Rechtspraak API parameters confirmed via official PDF v1.15 + live calls. `creator` unreliability confirmed empirically. |
| Features | MEDIUM-HIGH | Table stakes are clear and directly address known broken behavior. Differentiator feasibility depends on geo-extraction accuracy (anonymization impact is a known unknown). Bekendmakingen cross-ref confirmed infeasible for v13.0. |
| Architecture | HIGH | Full codebase analysis of existing jurisprudence stack (3 layers). RulingCache as org-agnostic central store is the unambiguous architectural decision. Build order derived from hard dependency chain. |
| Pitfalls | HIGH | 14 pitfalls identified, most verified against existing implementation behavior or live API testing. Phase-specific warnings map cleanly to suggested phases. "Looks Done But Isn't" checklist provides concrete acceptance criteria. |

**Overall confidence:** HIGH

### Gaps to Address

- **Gemeente-to-rechtbank mapping completeness:** Need to verify all 342 current gemeenten are mapped correctly. CBS gemeente list is available in-app but cross-reference with rechtbank jurisdiction data (from rechtspraak.nl) needs manual validation for border cases. Include old court codes (16 pre-2013 codes documented in FEATURES.md).

- **Geo-extraction accuracy on anonymized text:** Need empirical testing on 50+ real rulings before committing to regex patterns. The anonymization policy may vary by court. The "college van B&W van {gemeente}" pattern is verified but other patterns need measurement.

- **Doorlooptijd date availability:** What percentage of rulings contain extractable filing dates? If < 50%, the doorlooptijd feature needs a "onvoldoende data" fallback designed upfront, not retrofitted.

- **`creator` API parameter format:** The exact URI format for the `creator`/`instantie` parameter is unverified (live testing returned 0 results with `creator=http://psi.rechtspraak.nl/rblim&subject=omgevingsrecht`). Client-side ECLI filtering is the confirmed fallback, but revisit if Rechtspraak publishes updated documentation or a working URI format is discovered.

- **Old court code coverage:** Pre-2013 rulings use 16 discontinued court codes (RBMAA, RBUTR, RBARN, etc.). The mapping must include these for historical search completeness -- all documented in FEATURES.md with merger targets.

## Sources

### Primary (HIGH confidence)
- Rechtspraak Open Data v1.15 official PDF -- API specification, parameter list, rate limits (10 req/s)
- Rechtspraak Waardelijst endpoints (live verified) -- all 11 current Rechtbank codes + Rechtsgebieden URIs confirmed
- Rechtspraak search endpoint (live verified) -- 20,984 omgevingsrecht rulings confirmed, `creator` parameter unreliability confirmed
- EU e-Justice ECLI specification -- court code structure (`ECLI:NL:{COURT}:{YEAR}:{ID}`)
- Existing Propdex codebase -- `rechtspraak.py`, `jurisprudence.py`, `jurisprudence_analysis.py`, `JurisprudenceSection.tsx`, `useJurisprudence.ts`
- Project MEMORY notes (2026-03-07) -- user requirements for two-tab layout, ECLI filtering preference, component line limit

### Secondary (MEDIUM confidence)
- wetsuite rechtspraaknl library docs -- API parameter documentation
- rechtspraak-extractor PyPI -- sd/ed date parameter reference
- Open Rechtspraak API docs (Open State Foundation) -- third-party API wrapper documentation
- dutchcivillaw.com -- complete gemeente-to-rechtbank mapping reference
- Wikipedia Rechterlijke indeling van Nederland -- judicial district overview

### Tertiary (LOW confidence)
- Geo-extraction accuracy estimates (70-80% regex capture rate) -- needs empirical validation on real ruling texts
- Doorlooptijd date availability -- assumed available in metadata, needs measurement on sample of 50+ rulings
- spaCy Dutch NER performance on legal text -- confirmed unsuitable (training data is news, not legal), but no direct testing performed

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
