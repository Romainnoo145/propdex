# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v13.0 Juridisch Klimaat Intelligence -- Phase 83

---

## Current Position

Phase: 83 of 86 (Geo Contextualization Feed)
Plan: 1 of 2 in current phase
Status: In Progress
Last activity: 2026-03-07 -- Completed 83-01-PLAN.md

Progress: [█████░░░░░] 50%

---

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 3.3min
- Total execution time: 10min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 82 | 2 | 7min | 3.5min |
| 83 | 1 | 3min | 3min |

*Updated after each plan completion*

## Accumulated Context

### Key Patterns (carry forward)

- Rechtspraak API: XML-based, ECLI identifiers, 10 req/s rate limit, `creator` param unreliable
- ECLI structure: `ECLI:NL:{COURT}:{YEAR}:{ID}` -- court code is the geographic key
- Existing jurisprudence: useJurisprudence hook, JurisprudenceSection (302 lines), backend search endpoint
- ARQ job pattern: session factory in context, background ingestion with polling
- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- Per-ruling AI caching (not per-batch) to survive filter changes

### Decisions Made

- ECLI prefix filtering (client-side) over `creator` API param (returned 0 results in testing)
- ruling_cache table is org-agnostic (court rulings are public data, no organization_id)
- Regex + known gemeente list for geo-extraction (not spaCy -- training data is news, not legal text)
- Bekendmakingen cross-reference deferred (no shared identifier between Rechtspraak and SRU)
- [Phase 82]: 346 gemeenten mapped (includes historical/merged names for older ruling compatibility)
- [Phase 82]: RulingCache uses TimestampMixin but NOT TenantMixin (court rulings are public data)
- [Phase 82]: Client-side ECLI filtering via search_by_court() + extract_court_code()
- [Phase 82]: Semaphore(5) concurrency for batch document fetching
- [Phase 82]: ARQ job dedup via _job_id to prevent duplicate ingestion
- [Phase 82]: Stale-while-revalidate pattern for ruling cache endpoint
- [Phase 83]: Progressive word-prefix matching for gemeente extraction from legal text
- [Phase 83]: RVS rulings stored with gemeente_query=None, geo-tagged via text extraction
- [Phase 83]: Shared Semaphore(5) for combined rechtbank + RVS document fetching

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- Production deployment: Create app_role (sql/setup_app_role.sql)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-07T15:22:53Z
**Stopped At:** Completed 83-01-PLAN.md
**Resume File:** None

**Next Action:** Execute 83-02-PLAN.md (Geo Contextualization Feed plan 2)

---

*State updated: 2026-03-07 -- Completed 83-01-PLAN.md*
