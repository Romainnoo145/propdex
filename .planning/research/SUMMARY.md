# Project Research Summary

**Project:** Propdex v11.0 — Open Data Intelligence
**Domain:** Dutch PropTech — CBS Neighborhood Stats, Rechtspraak Jurisprudence, AI Legal Analysis
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

Propdex v11.0 adds three open data intelligence tracks to the existing production platform: CBS neighborhood metrics display, Rechtspraak court ruling search + document viewer, and AI-powered legal precedent analysis via Claude. Critically, substantial scaffolding for all three tracks is already in the codebase — CBS data is already fetched and stored during scans, Rechtspraak search and document endpoints are already live, and the JurisprudenceSection frontend component is already rendered in WijkDetailView. The fastest-to-ship track (CBS display) requires zero backend changes — only a `CbsNeighborhoodCard` frontend component wiring up data already present in the API response.

The recommended implementation order is: (1) CBS display first as a pure frontend win, (2) AI legal analysis backend extension using the existing ClaudeClient pattern, (3) AI legal analysis frontend, followed by (4) CBS OData v4 migration to future-proof the data source. The most valuable differentiator in the milestone is the AI juridisch klimaat summary — no NL PropTech competitor combines CBS context with Rechtspraak legal precedent analysis in a single developer workflow. This is a first-mover position worth protecting.

The primary risks are technical, not domain-related. CBS OData has a v3-to-v4 migration trap where the existing client uses the deprecated v3 URL and entity structure (`TypedDataSet` instead of `Observations`). Rechtspraak XML is notoriously inconsistent with missing document bodies, invalid RDF, and a search API that is far less capable than the web interface suggests. AI legal analysis carries the hallucination risk if Claude is asked to generate citations rather than summarize provided text. All three risks have clear mitigations already documented in PITFALLS.md and must be addressed phase-by-phase.

## Key Findings

### Recommended Stack

No new dependencies are needed for any v11.0 feature. The full existing stack handles all three tracks: `httpx` for CBS OData v4 queries (manual params — no CBS library), `lxml.etree` for secure XML parsing (already installed, needs migration from stdlib `xml.etree.ElementTree` in `rechtspraak.py`), and `anthropic` SDK's native `messages.parse()` with Pydantic for structured AI output (GA as of early 2026, no beta header needed). One infrastructure fix is required: `app/government_apis/exceptions.py` does not exist but is imported in multiple files — it needs to be created as a re-export from `base.py`.

**Core technologies:**
- `httpx.AsyncClient`: CBS OData v4 queries — manual params dict, no library abstraction needed
- `lxml.etree` (v5.3.0+): Rechtspraak XML parsing — must replace stdlib to get XXE protection and reliable namespace handling
- `anthropic` SDK `messages.parse()`: Structured AI output — native GA, no `instructor` wrapper needed
- `aiolimiter` / `APIRateLimiter`: Rate limiting — CBS and Rechtspraak clients must use the project singleton pattern, not bare `asyncio.Semaphore`
- `arq` + Redis: Background jobs — AI analysis (10-30s) must not block HTTP responses if latency requires escalation

### Expected Features

**Must have (table stakes — data already collected but not shown):**
- CBS metrics visible in WijkDetailView — data is in `neighborhood_metrics` JSONB, not rendering it is a broken experience
- Average WOZ value per wijk — already fetched, needs `CbsNeighborhoodCard` component
- Urbanization class (stedelijkheidsklasse) — already fetched, needs display with 1-5 scale badge
- CBS data freshness indicator (peiljaar) — users need to know if stats are 2023 or 2025

**Must have (Rechtspraak — backend + frontend already live, polish needed):**
- Omgevingsrecht / bestuursrecht filter in search UI — Rechtspraak `subject` parameter already supported
- Ruling outcome classification badge — use Claude on `inhoudsindicatie` (100-300 chars, low cost)

**Should have (competitive differentiators):**
- AI juridisch klimaat summary — synthesizes multiple rulings into "X% succeskans, top risk factors" — first-mover in NL PropTech
- Vergunnings-succeskans score (0-100%) — per-ruling outcome classification feeds statistical aggregation
- CBS market context card visual (WOZ, huurwoningen%, bevolkingsdichtheid, inkomen)

**Defer (v2+):**
- CBS multi-year WOZ trend analysis — requires fetching and joining multiple annual datasets
- Weekly AI ruling digest notifications — complex notification infrastructure, alert fatigue risk
- Cross-gemeente legal risk benchmarking
- CBS scoring contribution to parcel opportunity score — validate CBS improves lead quality first

**Anti-features to explicitly avoid:**
- Automated permit success predictions with confidence scores — frame as "historical precedent context" not legal prediction
- Full-text search within ruling documents — the public Rechtspraak API does not support this
- CBS data at parcel level — CBS statistics are wijk/buurt level only; parcel WOZ comes from Waardeloket (already built)

### Architecture Approach

The integration is additive to a well-structured ~46,220 LOC system. All data flows are mostly wired — the missing pieces are a frontend rendering component (CBS display), a Claude method extension plus endpoint (AI analysis), and an OData v4 client rewrite (CBS migration). The existing patterns to follow: government API client singletons, fire-and-forget non-fatal enrichment for supplementary data sources, JSONB columns for evolving API payloads, Pydantic structured outputs from Claude, and TanStack Query stale times calibrated to data volatility.

**Major components:**
1. `CbsNeighborhoodCard` (new frontend component) — renders `neighborhood_metrics` JSONB already present in API response; null-guarded for partial CBS coverage
2. `ClaudeClient.analyze_jurisprudence()` (extend existing) — batch ECLI texts + context → `JurisprudenceAnalysis` Pydantic structured output
3. `POST /api/jurisprudence/analyze` (extend existing router) — max 3-5 ECLIs, synchronous initially with ARQ escalation path if latency demands
4. AI results panel in `JurisprudenceSection` (extend existing component) — "Analyseer juridisch klimaat" button + risk score + succeskans bar + prose + disclaimer
5. `CBSODataClient` rewrite (existing file) — migrate from OData v3 (`opendata.cbs.nl`) to v4 (`datasets.cbs.nl`), switch to `Observations` entity, gemeente code-prefixed wijk lookup

### Critical Pitfalls

1. **Wrong CBS API URL (v3 vs v4)** — The existing `cbs_odata.py` uses `opendata.cbs.nl/ODataApi/OData` (deprecated v3). Must switch to `datasets.cbs.nl/odata/v1/CBS/` and query `Observations` + `WijkenEnBuurtenCodes` — not `TypedDataSet` which does not exist in v4.

2. **Ambiguous CBS wijk name lookup** — "Centrum" matches 80+ records nationally. Must filter by gemeente code prefix (`startswith(Identifier, 'WK{gemeente_code}')`) before matching by name. AreaScan already has `gemeente_code` — pass it directly.

3. **Non-existent module imports** — `app.government_apis.exceptions` and `app.api.deps` do not exist in this codebase. Exception classes live in `app.government_apis.base`. All new imports must be verified against actual file paths before writing.

4. **AI hallucinated citations** — Never ask Claude to find or generate case references. Only feed Claude actual ECLI texts retrieved from Rechtspraak and ask it to summarize. Store source ECLIs alongside every AI result for audit trail.

5. **Rechtspraak XML inconsistency** — Many rulings have no `<uitspraak>` body, invalid RDF, and malformed namespaces. All XML parsing must use `lxml.etree` with XXE protection (`resolve_entities=False, no_network=True`), guard every `elem.text` with `or ""`, and raise `GovernmentAPIError` — never return error dicts that produce HTTP 200 responses with embedded error payloads.

6. **Missing rate limiters** — CBS and Rechtspraak clients must register `APIRateLimiter` singletons in `rate_limiter.py`. CBS also needs explicit `timeout=10.0` on all requests — hung CBS calls block ARQ worker slots during area scans.

## Implications for Roadmap

Based on the research, three phases are recommended. The ordering follows the dependency graph: CBS display is data-only (no backend work), AI analysis requires Rechtspraak search (already live), and CBS v4 migration is independent but needed before relying on CBS data quality in production.

### Phase 1: CBS Neighborhood Metrics Display

**Rationale:** Fastest user-visible win in the milestone. Zero backend changes. CBS data is already fetched during scans and stored in `neighborhood_metrics` JSONB — not displaying it is a broken product experience. Ships in a single frontend-only plan.

**Delivers:** `CbsNeighborhoodMetrics` TypeScript interface narrowing `Record<string, any>`, `CbsNeighborhoodCard.tsx` component in WijkDetailView showing WOZ avg, stedelijkheidsklasse badge (1-5), huur/koop verhouding, bouwjaar distributie, peiljaar. Null guard for wijken where CBS returned no data.

**Addresses features:** CBS metrics visible in scan results (P1), WOZ display, urbanization class, peiljaar freshness indicator

**Avoids pitfalls:** Must type the `neighborhood_metrics` JSONB to the specific interface — cannot use `Record<string, any>` in the component. Must handle null gracefully — CBS coverage is ~80% for wijken, lower for buurten. Must show "Bron: CBS StatLine, peiljaar [year]" always.

**Research flag:** No research-phase needed. Patterns are well-established (existing card components, TanStack Query already serving the data). Prerequisite: run `alembic upgrade head` and verify `neighborhood_metrics` column exists and contains data.

---

### Phase 2: AI Juridisch Klimaat Analysis

**Rationale:** The core milestone differentiator. Rechtspraak search is already live. This phase extends it with Claude-powered synthesis — per-ruling outcome classification badges (low cost, high efficiency using `inhoudsindicatie`) and a full juridisch klimaat summary with succeskans score.

**Delivers:** `JurisprudenceAnalysis` Pydantic schema (`risk_score`, `vergunnings_succeskans`, `risk_summary`, `precedent_insights`, `disclaimer`), `JURISPRUDENCE_ANALYSIS_PROMPT` in `prompts.py`, `ClaudeClient.analyze_jurisprudence()` method, `POST /api/jurisprudence/analyze` endpoint (max 5 ECLIs), `useJurisprudenceAnalysis` TanStack hook, "Analyseer juridisch klimaat" button + AiRiskPanel in `JurisprudenceSection`. Also creates the missing `app/government_apis/exceptions.py` re-export module (startup blocker fix).

**Addresses features:** AI juridisch klimaat summary (P1), ruling outcome classification badge (P1), vergunnings-succeskans score (P2)

**Avoids pitfalls:** Prompt must only ask Claude to summarize provided texts, never generate citations. Store source ECLIs and `analyzed_at` alongside results. Truncate document text to ~50K chars. Start synchronous (max 3-5 ECLIs) — escalate to ARQ `parsing_job` pattern only if latency proves problematic.

**Research flag:** Prompt engineering for Dutch legal analysis may need iteration. Run a test against 5 real Raad van State `bestuursrecht` rulings before treating the `JurisprudenceAnalysis` schema as final. The `vergunnings_succeskans` (0-100) field needs clear prompt calibration so Claude produces defensible estimates, not arbitrary numbers.

---

### Phase 3: CBS OData v4 Migration + Infrastructure Hardening

**Rationale:** The existing CBS client uses the deprecated OData v3 URL and `TypedDataSet` entity. CBS is actively migrating away from v3. This phase migrates to `datasets.cbs.nl/odata/v1/CBS/`, updates to `Observations` + `WijkenEnBuurtenCodes`, adds `CBS_DATASET_ID` config setting pointing to the 2025 dataset (`86165NED`), and hardens both CBS and Rechtspraak clients with proper `APIRateLimiter` singletons and explicit HTTP timeouts.

**Delivers:** CBS client rewritten for OData v4, dataset updated to `86165NED` (2025), gemeente code-prefixed wijk lookup (fixes ambiguous name matching), `cbs_odata_limiter` and `rechtspraak_limiter` in `rate_limiter.py`, `xml.etree.ElementTree` replaced by `lxml.etree` with XXE protection in `rechtspraak.py`, ECLI format validation regex in jurisprudence endpoint, cache TTL constants added to config.

**Addresses pitfalls:** CBS v3/v4 cluster (Pitfalls 1-2, 5-7), infrastructure gap cluster (Pitfalls 3-4, 9, 14-15), Rechtspraak XML security (Pitfall 8, 11)

**Research flag:** Before implementing, verify measure codes for dataset `86165NED` at `https://datasets.cbs.nl/odata/v1/CBS/86165NED/MeasureCodes` — CBS occasionally renames measures between annual releases. The 12 codes documented in FEATURES.md were verified against `85984NED` (2024), not `86165NED` (2025).

---

### Phase Ordering Rationale

- Phase 1 first: completely independent of backend changes, delivers immediate visible value, zero risk surface
- Phase 2 before Phase 3: AI analysis builds on Rechtspraak search (already live). CBS display in Phase 1 can serve data from the v3 client — Phase 3 upgrades the underlying data source without blocking Phase 1 or Phase 2
- Phase 3 last: de-risks the CBS client rewrite (touching the area scan job) by letting Phase 1 validate that CBS data is being fetched and displayed correctly first, then Phase 3 migrates the fetch mechanism
- `exceptions.py` re-export module must be created at the start of Phase 2 since `jurisprudence.py` already imports from it and will cause `ImportError` on startup otherwise

### Research Flags

**Needs validation before/during implementation:**
- Phase 2 (AI analysis): Dutch legal prompt engineering needs live testing with real Raad van State rulings before finalizing the `JurisprudenceAnalysis` schema. The `vergunnings_succeskans` integer field needs calibration guidance in the prompt.
- Phase 3 (CBS v4 migration): OData v4 measure codes for dataset `86165NED` must be verified live at `https://datasets.cbs.nl/odata/v1/CBS/86165NED/MeasureCodes` before writing the client rewrite.

**Standard patterns — skip research-phase:**
- Phase 1 (CBS display): Pure frontend rendering task. Existing card component patterns, TypeScript interfaces, and TanStack Query data flow are completely established.
- Phase 3 infrastructure hardening (rate limiters, ECLI validation, lxml migration): All follow established patterns documented in `rate_limiter.py`, `sru_bekendmakingen.py`, and `base.py`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection — no new packages needed; all integration patterns verified against live codebase and official SDK docs |
| Features | HIGH | CBS API verified live, Rechtspraak corpus verified live (3.57M rulings as of 2026-03-06), existing codebase components confirmed by direct file reads |
| Architecture | HIGH | All component boundaries confirmed by direct file reads, not inferred. Data flow traced from ARQ job through DB through API response to frontend type definitions |
| Pitfalls | HIGH | Most pitfalls sourced from actual failed first attempt in the codebase + official CBS v3-to-v4 migration guide + confirmed Rechtspraak XML quirks from wetsuite documentation |

**Overall confidence:** HIGH

### Gaps to Address

- **CBS 2025 dataset measure code verification:** The 12 measure codes in FEATURES.md were verified against `85984NED` (2024). Phase 3 targets `86165NED` (2025). Verify codes before the client rewrite — CBS has a history of renaming measures between annual releases.

- **AI analysis latency under real conditions:** Architecture research recommends starting synchronous (max 3-5 ECLIs). Actual latency for multi-ECLI analysis with real Raad van State documents (which can be 80,000+ tokens) is unknown until tested. Have the ARQ escalation path ready if needed.

- **Alembic migration status:** `1a67b08d7c1b_add_neighborhood_metrics_to_area_scan.py` exists but may not be applied. Phase 1 prerequisite: run `alembic upgrade head` and confirm `neighborhood_metrics` column exists and contains populated data for existing scans.

- **`exceptions.py` re-export is a startup blocker:** `app/government_apis/exceptions.py` does not exist but is imported by `rechtspraak.py` and `jurisprudence.py`. Will cause `ImportError` on startup. Must be created at the start of Phase 2 before any endpoint testing.

## Sources

### Primary (HIGH confidence)
- `backend/pyproject.toml` — verified full dependency set; no new packages needed
- `backend/app/government_apis/cbs_odata.py` — existing CBS OData client scaffold, v3 URL and `TypedDataSet` usage confirmed
- `backend/app/government_apis/rechtspraak.py` — stdlib XML usage, inline semaphore, confirmed missing `exceptions` module import
- `backend/app/jobs/area_scan.py` (lines 340-394) — CBS fetch integration in Phase 2 of scan job confirmed
- `backend/app/models/area_scan.py` — `neighborhood_metrics` JSONB column confirmed
- `backend/app/scans/schemas.py:227` — `neighborhood_metrics: dict | None` in ScanResultsResponse confirmed
- `backend/app/ai/claude_client.py` + `prompts.py` + `schemas.py` — established AI integration pattern verified
- `backend/app/api/endpoints/jurisprudence.py` — search + doc endpoints confirmed live
- `backend/app/main.py` — jurisprudence router registration at `/api/jurisprudence` confirmed
- `frontend/src/components/projects/JurisprudenceSection.tsx` — full component confirmed live
- `frontend/src/components/projects/WijkDetailView.tsx` — JurisprudenceSection mount confirmed
- `frontend/src/hooks/useJurisprudence.ts` — `useJurisprudenceSearch` + `useJurisprudenceDoc` hooks confirmed
- `frontend/src/lib/types/scan.ts:169` — `neighborhood_metrics?: Record<string, any> | null` confirmed
- `https://opendata.cbs.nl/ODataApi/OData/85618NED` — live API verification, v3 entity structure (`TypedDataSet`, `WijkenEnBuurten`) confirmed
- `https://datasets.cbs.nl/odata/v1/CBS/85984NED/MeasureCodes` — 12 PropTech-relevant measure codes verified live
- `https://platform.claude.com/docs/en/build-with-claude/structured-outputs` — `messages.parse()` GA confirmed, no beta header required
- CBS v3-to-v4 migration guide — `Handleiding overstap OData v3 naar v4` (official CBS PDF)
- CBS dataset annual series confirmed: 2022=`85318NED`, 2023=`85618NED`, 2024=`85984NED`, 2025=`86165NED`

### Secondary (MEDIUM confidence)
- `https://www.rechtspraak.nl/SiteCollectionDocuments/Technische-documentatie-Open-Data-van-de-Rechtspraak.pdf` — official Rechtspraak API technical documentation, namespace declarations (referenced from official source, not directly fetched)
- `https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html` — Rechtspraak API quirks: invalid XML, missing bodies, search limitations
- CBS Quick Start Guide: `https://www.cbs.nl/en-gb/our-services/open-data/statline-as-open-data/quick-start-guide`

### Tertiary (LOW confidence — apply mitigations regardless)
- AI hallucination risk in legal context — multiple sources cite LLM citation fabrication; referenced Anthropic's own legal team case via Terms.Law (2025-03). Mitigation is clear: only feed Claude retrieved documents, never ask it to find cases.

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
