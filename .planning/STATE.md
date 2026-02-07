# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 5 of 5 (Report Management)
**Plan:** 1 of 3 completed
**Status:** In progress

**Progress:** [███████████████░░░░░] 15/18 plans complete (83%)

**Last Activity:** 2026-02-07 — Completed 05-01-PLAN.md (Report Storage Foundation)

**Next Action:** Execute 05-02 (CRUD Endpoints)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 9 (INFRA-01, INFRA-02, INFRA-04, DATA-01, DATA-02, PROP-03, PROP-04, PROP-05, PROP-06) |
| Phases Completed | 4/5 |
| Plans Completed | 15/18 |
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
| 63 | claude-sonnet-4-5-20250929 for PDF parsing | 04-02 | Good balance of cost and quality for document extraction; Sonnet 4.5 has native PDF support via vision and structured outputs |
| 64 | Ephemeral prompt caching for PDF and system prompt | 04-02 | Reduces API costs for repeated parsing attempts; PDF bytes cached alongside prompt |
| 65 | JSON extraction with markdown cleanup | 04-02 | Claude may wrap JSON in markdown code blocks; strip ```json and ``` before Pydantic validation |
| 66 | AIParsingError with retriable flag | 04-02 | Distinguishes temporary failures (rate limit, network) from permanent ones (invalid JSON); enables smart retry logic in ARQ worker |
| 67 | IMRO regex pattern NL.IMRO.{4 digits}.{plan}-{version} | 04-02 | Standard Dutch zoning plan identifier format; prevents invalid downloads and storage |
| 68 | Ruimtelijkeplannen.nl URL pattern for auto-download | 04-02 | Official Dutch government repository for bestemmingsplannen; predictable URL structure enables auto-download |
| 69 | 100MB PDF size limit | 04-02 | Prevents memory issues and excessive API costs; typical bestemmingsplan PDFs are 1-20MB |
| 70 | is_user_uploaded boolean flag | 04-02 | Distinguishes auto-downloaded from manually uploaded PDFs; enables analytics and fallback workflows |
| 71 | Worker creates own DB session | 04-03 | ARQ worker runs outside FastAPI lifecycle; must create engine from settings.DATABASE_URL with proper lifecycle management |
| 72 | Upsert pattern for CachedAPIResponse | 04-03 | Check if exists by (organization_id, cache_key), update or create; prevents duplicates while allowing cache refresh |
| 73 | Cache-first strategy in plan aggregator | 04-03 | Check cache → active jobs → download failures → enqueue; makes repeated lookups instant, reduces Claude API costs |
| 74 | Download failures return pdf_not_found | 04-03 | Plan aggregator detects PDFDownloadError, returns upload_required=True; frontend shows upload UI per user decision |
| 75 | Reusable enqueue_parsing_job function | 04-03 | Callable from both get_or_parse_plan and upload endpoint; avoids duplication of job creation logic |
| 76 | Job status polling validates tenant ownership | 04-03 | get_job_status checks organization_id matches ParsingJob; prevents cross-tenant job status leakage |
| 77 | ARQ pool in FastAPI lifespan | 04-04 | Singleton pattern ensures one Redis connection pool per app instance; available via request.app.state.arq_pool |
| 78 | Progressive loading pattern for AI parsing | 04-04 | Property lookup returns immediately with API data + job_id; frontend polls for AI results; never blocks on Claude API (10-30s) |
| 79 | Job status endpoint with Dutch progress messages | 04-04 | Returns progress_pct estimates (10% queued, 50% in_progress, 100% complete) with user-facing messages |
| 80 | PDF upload accepts content_type OR filename | 04-04 | Flexible validation (content_type == "application/pdf" OR filename.endswith(".pdf")); handles different client behaviors |
| 81 | Completeness score expanded to 6 sections | 04-04 | Was 5 (address/building/parcels/zoning/monuments), now includes ai_parsing when status is "complete" |
| 82 | AI parsing section source as MEDIUM confidence | 04-04 | Claude AI-parsed data labeled MEDIUM confidence vs HIGH for government APIs; transparent about data reliability |
| 83 | JSONB storage for full PropertyReportResponse | 05-01 | Complete report snapshots with all sections for historical comparison and PDF export; PostgreSQL JSONB efficient storage |
| 84 | Denormalized postcode and city fields | 05-01 | Efficient filtering with composite indexes (org, city), (org, postcode) without JSONB extraction overhead |
| 85 | Soft-delete with deleted_at column | 05-01 | Recoverable deletion for accidental deletes; indexed for efficient "WHERE deleted_at IS NULL" queries |
| 86 | GIN trigram index on report_name | 05-01 | Fast ILIKE '%address%' searches using pg_trgm extension; handles typos and partial matches |
| 87 | Optional project_id with SET NULL | 05-01 | Reports can exist without projects; deleting project doesn't delete reports (folder organization, not ownership) |
| 88 | Auto-generated report_name from address | 05-01 | Consistent naming convention; report_name not user-editable for simplicity and consistency |
| 89 | Composite indexes with organization_id first | 05-01 | Follows project decision #6; PostgreSQL query planner optimizes tenant-scoped queries across all report indexes |

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
- [x] ~~Implement Claude API client with PDF support (04-02)~~ (completed 04-02)
- [x] ~~Implement ARQ worker for background parsing (04-03)~~ (completed 04-03)
- [x] ~~Implement API endpoints with job queueing (04-04)~~ (completed 04-04)
- [x] ~~Begin Phase 5 planning (Report Management)~~ (completed 05-RESEARCH)
- [x] ~~Create report storage foundation (05-01)~~ (completed 05-01)
- [ ] Implement report CRUD endpoints (05-02)
- [ ] Test Claude API with real bestemmingsplan PDFs (integration testing)

### Blockers

(None)

### Recent Wins

- **Phase 5 Plan 1 Complete (2026-02-07):** Report storage foundation with JSONB PropertyReportResponse, denormalized filtering, GIN trigram search, soft-delete, project folders, 3m 6s execution
- **Phase 4 Complete (2026-02-07):** AI document parsing infrastructure with progressive loading pattern, job polling, PDF upload fallback, complete end-to-end integration
- **Phase 4 Plan 4 Complete (2026-02-07):** API endpoints with ARQ pool in FastAPI lifespan, job status polling, PDF upload fallback, property lookup AI integration, 4m 5s execution
- **Phase 4 Plan 3 Complete (2026-02-07):** ARQ background worker with cache-first plan aggregator, tenant-isolated job tracking, pdf_not_found upload fallback, reusable job enqueue, 2m 19s execution
- **Phase 4 Plan 2 Complete (2026-02-07):** Claude AI client with PDF parsing, Dutch confidence scoring prompt, Ruimtelijkeplannen.nl download service with IMRO validation, 4m 2s execution
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

**Last Session:** 2026-02-07 — Executed 05-01-PLAN.md
**Stopped At:** Completed 05-01 (Report Storage Foundation)
**Resume File:** None

**What Was Accomplished:**
- Created SavedReport model with JSONB report_data, denormalized postcode/city, soft-delete, project FK
- Created Project model for report folder organization with composite index (org, name)
- Added Alembic migration creating both tables with pg_trgm extension for GIN trigram search
- Created 9 indexes including composite (org first), GIN trigram on report_name, soft-delete index
- Created Project and Report Pydantic schemas (create, update, list, detail, freshness)
- ReportSaveRequest validates report_data as PropertyReportResponse
- All verifications passed, 3 atomic commits created (922187c, 98bf446, a037007)
- Execution time: 3 minutes 6 seconds

**Context for Next Session:**
- **Phase 5 Started:** Report management infrastructure foundation complete
- **Database Ready:** saved_reports and projects tables with all indexes, pg_trgm enabled
- **Schemas Ready:** All CRUD schemas validated, PropertyReportResponse integration working
- **Next:** Implement CRUD endpoints (05-02) for saving, listing, updating reports
- **Key Patterns:** report_name from address, completeness_score from JSONB, soft-delete WHERE deleted_at IS NULL
- **GIN Search:** Use ILIKE '%query%' on report_name for address search (trigram optimized)
- **Project Count:** Need COUNT subquery for report_count in ProjectResponse

---

*Last updated: 2026-02-07T10:43:29Z
