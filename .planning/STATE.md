# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v13.0 Juridisch Klimaat Intelligence -- Phase 82

---

## Current Position

Phase: 82 of 86 (Ruling Cache + ECLI Court Mapping)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phase Complete
Last activity: 2026-03-07 -- Completed 82-02-PLAN.md

Progress: [██████████] 100%

---

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 3.5min
- Total execution time: 7min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 82 | 2 | 7min | 3.5min |

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

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- Production deployment: Create app_role (sql/setup_app_role.sql)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-07T14:15:36Z
**Stopped At:** Completed 82-02-PLAN.md (Phase 82 complete)
**Resume File:** None

**Next Action:** `/gsd:execute-phase 83` (Geo Contextualization Feed)

---

*State updated: 2026-03-07 -- Completed 82-02-PLAN.md*
