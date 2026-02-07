# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 3 of 5 (Zoning & Monument Intelligence) — IN PROGRESS
**Plan:** 3 of 4 completed
**Status:** In progress

**Progress:** [██████░███░░░░░░░░░░] 9/15 plans complete (60%)

**Last Activity:** 2026-02-07 — Completed 03-03-PLAN.md (RCE Monument Client & Multi-source Aggregator)

**Next Action:** Execute 03-04 (Property Report Aggregator)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 4 (INFRA-01, INFRA-02, DATA-01, DATA-02) |
| Phases Completed | 2/5 |
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
- [ ] Implement property report aggregator (03-04)
- [ ] Test Claude API with real bestemmingsplan PDFs during Phase 4 planning

### Blockers

(None)

### Recent Wins

- **03-03 RCE Monument Client (2026-02-07):** RCE Rijksmonument Solr API with pyproj coordinate transformation, multi-source aggregator (RCE/BAG/Kadaster), conflict detection, Dutch restriction summaries, 2-minute execution
- **03-02 DSO Zoning Client (2026-02-07):** DSO Ruimtelijke Plannen v4 client with POST+GeoJSON spatial queries, HAL+JSON pagination, shapely intersection, Dutch maatvoering parsing, 2-minute execution
- **03-01 Phase 3 Foundation (2026-02-07):** Spatial dependencies (shapely, pyproj), complete Phase 3 schemas (zoning, monuments, map data), force_refresh cache capability, 3-minute execution
- **Phase 2 Complete (2026-02-07):** Full property data pipeline with parallel API fetching, completeness scoring, and authenticated endpoints
- **02-03 Property Aggregator (2026-02-07):** Property lookup endpoint with asyncio.gather parallel fetch, completeness scoring, 3-minute execution
- **02-02 Government API Clients (2026-02-07):** BAG and PDOK clients with Dutch postcode validation, hierarchical address resolution, per-call caching, 2-minute execution
- **02-01 HTTP Client & Cache (2026-02-07):** Shared httpx AsyncClient with HTTP/2, PostgreSQL JSONB cache with TTL-based invalidation, 3-minute execution

---

## Session Continuity

**Last Session:** 2026-02-07 — Executed 03-03-PLAN.md
**Stopped At:** Completed 03-03 (RCE Monument Client & Multi-source Aggregator)
**Resume File:** None

**What Was Accomplished:**
- Created RCEMonumentClient with Solr geofilt spatial queries using WGS84 coordinates
- Implemented pyproj coordinate transformation (RD EPSG:28992 ↔ WGS84 EPSG:4326)
- Built monument aggregator fetching from RCE, BAG, Kadaster in parallel with asyncio.gather
- Added multi-source conflict detection comparing definitive sources
- Implemented consensus status logic (only when all sources agree)
- Generated plain-language Dutch restriction summaries per monument type
- Conservative approach: ANY source confirming monument sets is_monument=True
- Cache integration with rce source (30d TTL) and force_refresh support
- All verifications passed, 2 atomic commits created (ae34b2b, 527d58d)
- Execution time: 2 minutes

**Context for Next Session:**
- **RCE Monument Client Ready:** Solr API with WGS84 geofilt queries, 50m search radius
- **Coordinate Transformation:** pyproj module-level transformers for RD↔WGS84 conversion
- **Multi-Source Aggregation:** Parallel fetch from RCE, BAG, Kadaster with conflict detection
- **Conservative Monument Detection:** ANY source confirming monument status sets is_monument=True
- **Dutch Restriction Summaries:** Standard guidance text (4 restrictions for rijksmonument, 3 for gemeentelijk)
- **Cache Integration:** 30-day TTL with force_refresh capability
- **Next:** Implement Property Report Aggregator (03-04) to combine address, cadastral, zoning, and monument data
- Building coordinates from Phase 2 available for RCE spatial queries
- Zoning data from 03-02 ready for report aggregation
- Monument status provides critical investment intelligence (€200k-500k renovation impact)

---

*Last updated: 2026-02-07T07:43:01Z*
