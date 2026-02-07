# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 4 of 5 (AI Document Parsing)
**Plan:** 1 of 4 completed
**Status:** In progress

**Progress:** [███████████░░░░░░░░░] 11/15 plans complete (73%)

**Last Activity:** 2026-02-07 — Completed 04-01-PLAN.md (AI Foundation)

**Next Action:** Plan 04-02 (Claude API Client)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 7 (INFRA-01, INFRA-02, DATA-01, DATA-02, PROP-03, PROP-04, PROP-06) |
| Phases Completed | 3/5 |
| Plans Completed | 7/15 (estimated) |
| Days Since Start | 2 |

---

## Accumulated Context

### Key Decisions

| ID | Decision | Phase-Plan | Rationale |
|----|----------|------------|-----------|
| 1 | Multi-tenant from day one | Planning | Architecture supports single-tenant MVP while enabling SaaS expansion (organization_id on all queries) |
| 2 | API-first with AI fallback | Planning | Government APIs for structured data; Claude API for bestemmingsplan PDFs when API insufficient |
| 3 | Async AI processing | Planning | LLM document parsing runs in background jobs (10-30s) to avoid HTTP timeouts |
| 4 | Source-specific cache TTLs | Planning | BAG: 24h, Kadaster: 7d, bestemmingsplan: 90d based on data volatility |
| 5 | Confidence scoring mandatory | Planning | All AI-parsed data shows LOW/MEDIUM/HIGH confidence to prevent €500k+ investment mistakes |
| 6 | Composite indexes with organization_id first | 01-01 | PostgreSQL query planner can efficiently use indexes for tenant-filtered queries |
| 7 | RLS as defense-in-depth | 01-01 | Primary: app filtering; Secondary: RLS catches bugs; Prepares for production app_role enforcement |
| 8 | SQLAlchemy 2.x mapped_column syntax | 01-01 | Modern best practices, better type inference for mypy, cleaner code |
| 9 | CORS_ORIGINS as comma-separated string | 01-01 | Avoids pydantic-settings JSON parsing errors with empty .env values |
| 10 | PyJWT with explicit algorithms | 01-02 | Prevents algorithm confusion attacks; PyJWT is industry standard vs python-jose |
| 11 | pwdlib with Argon2id | 01-02 | Memory-hard hashing resistant to GPU attacks; modern best practice vs bcrypt |
| 12 | Single-use refresh token rotation | 01-02 | Old token revoked on refresh; reuse detection triggers full account revocation |
| 13 | Naive datetimes for PostgreSQL | 01-02 | Database columns are TIMESTAMP WITHOUT TIME ZONE; timezone-aware causes errors |
| 14 | Tenant context middleware | 01-02 | Extract organization_id from JWT once per request; silent failure for public endpoints |
| 15 | JWT-based email verification/reset | 01-03 | No DB storage for verification/reset tokens; self-contained JWT with expiry; simplifies implementation |
| 16 | Password reset always returns 200 | 01-03 | Prevents user enumeration attacks; security best practice |
| 17 | Google OAuth no auto-linking | 01-03 | Email conflict returns 400; prevents account takeover via OAuth for MVP |
| 18 | Rate limiting in-memory for MVP | 01-03 | No Redis dependency for development; can switch to Redis backend later |
| 19 | Email sending graceful fallback | 01-03 | Logs URLs to console in dev; no SMTP server required for local development |
| 20 | FastAPI lifespan for shared resources | 02-01 | Modern pattern replaces startup/shutdown events; ensures proper cleanup |
| 21 | PostgreSQL JSONB cache over Redis | 02-01 | Reduces infrastructure complexity; leverages existing DB; cache survives restarts |
| 22 | Source-specific TTL per cache entry | 02-01 | Allows runtime tuning without code changes; supports different staleness per source |
| 23 | Explicit setuptools package discovery | 02-01 | Prevents build errors from multiple top-level folders (app, sql, alembic) |
| 24 | API clients receive httpx.AsyncClient as parameter | 02-02 | Ensures connection pooling works correctly; clients don't create their own httpx instances |
| 25 | BAG API calls cached individually (not aggregated) | 02-02 | Verblijfsobjecten and panden can be shared across addresses; caching each API call separately enables cross-address reuse |
| 26 | Graceful partial failure handling in address resolver | 02-02 | Returns address even if building lookup fails; better UX than complete failure |
| 27 | Dutch postcode normalized to '1234 AB' format | 02-02 | Consistent canonical format for storage and API calls; accepts both '1234AB' and '1234 AB' as input |
| 28 | Sequential address resolution then parallel fetch | 02-03 | Address must succeed before parallel building/parcel fetch; prevents wasted API calls and provides clear errors |
| 29 | Completeness score as fraction | 02-03 | sections_available / total_sections provides transparency about partial data without failing request |
| 30 | Source attribution with cache metadata | 02-03 | Each API tracked with source, cache timestamp, age; enables frontend to show freshness |
| 31 | B008 ruff ignore for FastAPI Depends | 02-03 | Standard dependency injection pattern; false positive from flake8-bugbear |
| 32 | shapely for GeoJSON parsing | 03-01 | shapely.geometry.shape() handles GeoJSON natively; no need for separate geojson library |
| 33 | 90-day cache TTL for DSO zoning data | 03-01 | Same as bestemmingsplan - zoning rules change very rarely |
| 34 | 30-day cache TTL for RCE monument data | 03-01 | Monument status changes more frequently than zoning but still infrequent |
| 35 | force_refresh defaults to False | 03-01 | Backward compatible; opt-in behavior for explicit cache bypass |
| 36 | Monument status ANY source confirms | 03-01 | Conservative approach - better to flag potential monument than miss heritage status |
| 37 | Confidence indicators on DataSourceInfo | 03-01 | Enables HIGH for API data, MEDIUM/LOW for AI-parsed data in Phase 4 |
| 38 | POST with GeoJSON Point for DSO spatial queries | 03-02 | DSO API requires POST to /plannen/_zoek with GeoJSON body for location-based lookups |
| 39 | HAL+JSON pagination limited to 5 pages | 03-02 | Prevents excessive API calls and timeouts while covering typical result sets |
| 40 | Sequential fetches inside cache_manager | 03-02 | Using asyncio.gather inside cache_manager's fetch function can cause issues; sequential is safer |
| 41 | Primary bestemming from most common function | 03-02 | When multiple plans overlap, most frequently occurring bestemming selected as primary |
| 42 | Consolidated dimensions from first available | 03-02 | Building dimensions taken from first rule with data rather than complex merging |
| 43 | Data gaps in Dutch for transparency | 03-02 | User-facing messages like "Geen bestemmingsvlakken op deze locatie" |
| 44 | RCE Solr API uses WGS84 coordinates | 03-03 | RCE requires WGS84 for geofilt; pyproj transforms RD (EPSG:28992) to WGS84 (EPSG:4326) |
| 45 | Monument restrictions are standard guidance text | 03-03 | Restrictions per monument type (not building-specific API data); immediate value without additional complexity |
| 46 | Conservative multi-source conflict detection | 03-03 | When sources disagree, has_conflict=True and consensus_status=None; better to flag uncertainty than false consensus |
| 47 | BAG/Kadaster monument indicators unavailable | 03-03 | MVP limitation - no monument fields in standard API; RCE is primary source |
| 48 | PropertyReportResponse replaces PropertyLookupResponse | 03-04 | New standard return type includes zoning, monuments, map_data, section_sources while maintaining core field compatibility |
| 49 | Section-level source attribution | 03-04 | SectionSourceInfo provides granular cache metadata per report section with Dutch relative timestamps |
| 50 | force_refresh defaults to False | 03-04 | Backward compatible; opt-in cache bypass for frontend "Vernieuwen" button |
| 51 | Map data with both RD and WGS84 coordinates | 03-04 | Enables direct use with OpenLayers/Leaflet while preserving Dutch coordinate system |
| 52 | Completeness score expanded to 5 sections | 03-04 | Was 3 (address/building/parcels), now includes zoning and monuments for transparency |
| 53 | Coordinate transformation in aggregator layer | 03-04 | RD to WGS84 conversion centralized in property_aggregator, not in individual API clients |
| 54 | anthropic>=0.40.0 for Claude API | 04-01 | Native PDF support (vision) and structured outputs (type-safe JSON); version 0.40.0+ required for PDF message format |
| 55 | arq>=0.27.0 for async task queue | 04-01 | Redis-based background job processing for PDF parsing (prevents HTTP timeouts for 10-30s Claude API calls) |
| 56 | 90-day cache TTL for ai_parsed | 04-01 | Same as bestemmingsplan - parsed plan rules apply to all addresses in zoning area, enables efficient reuse |
| 57 | Confidence scoring mandatory for AI data | 04-01 | HIGH/MEDIUM/LOW per rule + overall confidence; frontend must display disclaimers for LOW confidence |
| 58 | pdf_not_found status with upload_required | 04-01 | Signals frontend to show upload UI when auto-download fails; user decision pattern from 04-CONTEXT |
| 59 | PDF storage in PostgreSQL BYTEA | 04-01 | PDFDocument stores bytes in LargeBinary vs filesystem; enables multi-tenant isolation, transactional consistency |
| 60 | plan_idn as PDF reuse key | 04-01 | Multiple addresses in same bestemmingsplan share one PDF; keyed by (organization_id, plan_idn) |
| 61 | ParsingJob for tenant isolation | 04-01 | ARQ job_id stored with organization_id; prevents cross-tenant job status leakage in polling endpoint |
| 62 | Composite indexes (org, plan_idn) | 04-01 | ix_pdf_documents_org_plan and ix_parsing_jobs_org_plan optimize tenant-scoped queries |

### Active TODOs

- [x] ~~Start Phase 1: Foundation & Authentication planning~~ (completed 01-01)
- [x] ~~Implement authentication endpoints (01-02)~~ (completed 01-02)
- [x] ~~Implement email verification (01-03)~~ (completed 01-03)
- [x] ~~Begin Phase 2 planning (Address Intelligence)~~ (completed 02-RESEARCH)
- [x] ~~Implement HTTP client and cache infrastructure (02-01)~~ (completed 02-01)
- [x] ~~Implement BAG API client (02-02)~~ (completed 02-02)
- [x] ~~Implement property aggregator and endpoints (02-03)~~ (completed 02-03)
- [x] ~~Begin Phase 3 planning (Zoning & Monument Intelligence)~~ (completed 03-01)
- [x] ~~Implement DSO API client and zoning aggregator (03-02)~~ (completed 03-02)
- [x] ~~Implement RCE monument API client (03-03)~~ (completed 03-03)
- [x] ~~Implement property report aggregator (03-04)~~ (completed 03-04)
- [x] ~~Begin Phase 4 planning (AI Document Parsing)~~ (completed 04-01)
- [x] ~~Add AI infrastructure foundation (04-01)~~ (completed 04-01)
- [ ] Implement Claude API client with PDF support (04-02)
- [ ] Implement ARQ worker for background parsing (04-03)
- [ ] Test Claude API with real bestemmingsplan PDFs during 04-02/04-03

### Blockers

(None)

### Recent Wins

- **Phase 4 Plan 1 Complete (2026-02-07):** AI infrastructure foundation with anthropic and arq dependencies, Claude structured output schemas, PostgreSQL PDF storage, job tracking with tenant isolation, 2m 40s execution
- **Phase 3 Complete (2026-02-07):** Full property intelligence report with zoning rules, monument status, map data, section-level source attribution, and cache bypass
- **03-04 Property Report Aggregator (2026-02-07):** Parallel fetch (cadastral+zoning+monuments), WGS84 coordinate transformation, PropertyReportResponse with all Phase 3 sections, 2-minute execution
- **03-03 RCE Monument Client (2026-02-07):** RCE Rijksmonument Solr API with pyproj coordinate transformation, multi-source aggregator (RCE/BAG/Kadaster), conflict detection, Dutch restriction summaries, 2-minute execution
- **03-02 DSO Zoning Client (2026-02-07):** DSO Ruimtelijke Plannen v4 client with POST+GeoJSON spatial queries, HAL+JSON pagination, shapely intersection, Dutch maatvoering parsing, 2-minute execution
- **03-01 Phase 3 Foundation (2026-02-07):** Spatial dependencies (shapely, pyproj), complete Phase 3 schemas (zoning, monuments, map data), force_refresh cache capability, 3-minute execution
- **Phase 2 Complete (2026-02-07):** Full property data pipeline with parallel API fetching, completeness scoring, and authenticated endpoints
- **02-03 Property Aggregator (2026-02-07):** Property lookup endpoint with asyncio.gather parallel fetch, completeness scoring, 3-minute execution
- **02-02 Government API Clients (2026-02-07):** BAG and PDOK clients with Dutch postcode validation, hierarchical address resolution, per-call caching, 2-minute execution
- **02-01 HTTP Client & Cache (2026-02-07):** Shared httpx AsyncClient with HTTP/2, PostgreSQL JSONB cache with TTL-based invalidation, 3-minute execution

---

## Session Continuity

**Last Session:** 2026-02-07 — Executed 04-01-PLAN.md
**Stopped At:** Completed 04-01 (AI Document Parsing Foundation)
**Resume File:** None

**What Was Accomplished:**
- Added anthropic>=0.40.0 and arq>=0.27.0 dependencies to pyproject.toml
- Added ANTHROPIC_API_KEY and REDIS_URL config settings
- Added CACHE_TTL["ai_parsed"] = 7776000 (90 days)
- Created app/ai/schemas.py with 6 Pydantic models (BestemmingsplanParsed, BestemmingsregelExtract, BuildingDimensionsAI, AIParsingSection, JobStatusResponse)
- Created PDFDocument model with LargeBinary storage for PDF files
- Created ParsingJob model with ARQ job_id tracking for tenant isolation
- Generated and applied Alembic migration dedfd360f313 (pdf_documents + parsing_jobs tables)
- All verifications passed, 2 atomic commits created (465e9c9, f2ff7d1)
- Execution time: 2 minutes 40 seconds

**Context for Next Session:**
- **Phase 4 Plan 1 Complete:** AI infrastructure foundation ready
- **Dependencies Installed:** anthropic and arq packages available for import
- **Config Ready:** ANTHROPIC_API_KEY and REDIS_URL settings loadable from .env
- **Schemas Defined:** All Phase 4 Pydantic schemas in app/ai/schemas.py (no iteration needed in future plans)
- **Database Tables Exist:** pdf_documents and parsing_jobs tables migrated with tenant isolation
- **Confidence Scoring Pattern:** HIGH/MEDIUM/LOW per rule + overall confidence established
- **PDF Storage Pattern:** PostgreSQL BYTEA storage, keyed by (organization_id, plan_idn) for cross-address reuse
- **Job Tracking Pattern:** ParsingJob with ARQ job_id prevents cross-tenant leakage
- **Next:** Plan 04-02 (Claude API Client) requires ANTHROPIC_API_KEY in .env
- **Redis Required:** Plan 04-03 (ARQ Worker) requires Redis running on localhost:6379

---

*Last updated: 2026-02-07T09:08:15Z*
