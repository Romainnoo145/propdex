# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** Post-v7.2 validation and next milestone definition (workspace UX + monetization workflows)

---

## Current Position

Phase: 61 — Vergunning Precedenten Benchmark
Plan: 1/1 completed
Status: v7.2 shipped (Phases 59-61 complete)
Last activity: 2026-02-27 — Completed phase 61 and shipped v7.2 Developer Dossier Intelligence

---

## Performance Metrics

**v7.2 Developer Dossier Intelligence (Completed)**
- Phase 59 Plan 01: completed (buildability delta contract + calculations + report/map presentation)
- Phase 60 Plan 01: completed (Layer A Wkb precheck + optional Layer B refinement contract)
- Phase 61 Plan 01: completed (permit precedent benchmark by municipality + comparable type + report integration)

**v7.1 Workspace Productization (Completed)**
- Phase 58 Plan 01: completed (workspace role context + side-rail switcher + role-aware copy foundation)
- Phase 58 Plan 02: completed (project workspace URL-state hardening + source-aware report navigation)
- Phase 58 Plan 03: completed (meldingen/rapporten scope-aware controls + streamlined detail actions)
- Phase 58 Plan 04: completed (canonical map parcel flow + layer catalog + refresh-safe selection reset)
- Phase 58 Plan 05: completed (monitoring contract clarity + parcel report idempotency visibility + milestone handoff docs)

**v7.0 Deep Property Data (In Progress)**
- Phase 54 Plan 01: 3 min (BRK schema + aggregator wiring)
- Phase 54 Plan 02: 5 min (BRK strip-before-save + re-fetch-on-view + 6 integration tests)
- Phase 55 Plan 01: 5 min (RCE Linked Data two-step enrichment in monument_aggregator)
- Phase 55 Plan 02: 2 min (EP-Online + WOZ into 5-parallel Step 2a gather, completeness 6->9)

**v6.0 Meldingen Intelligence (Shipped: 2026-02-23)**
- 5 phases (47-51), 10 plans, 39 commits, 56 files changed (+8,818/-292)
- Phase 47: 7 min (2 plans, address extraction + category classification)
- Phase 48: 14 min (3 plans, geocoding + spatial matching + retro-match)
- Phase 49: 7 min (2 plans, ChangeReadState model + frontend migration)
- Phase 50: 2 min (1 plan, matched_parcel_id wired through frontend)
- Phase 51: 7 min (2 plans, gemeente filter + infinite scroll + action badges)

**v5.1 Data Presentation Overhaul (Shipped: 2026-02-22)**
- 5 phases (42-46), 10 plans — theme consistency, gemeente/wijk cards, drill-down navigation

**v5.0 Scan Intelligence (Shipped: 2026-02-20)**
- 5 phases (37-41), 11 plans, 51 commits, 65 files changed (+9,264/-2,326)

**v4.0 UX Redesign (Shipped: 2026-02-18)**
- 10 phases (27-36), 31 plans, 129 commits, ~16,234 LOC TypeScript/React

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 97 commits, ~27,200 LOC

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- SET LOCAL f-string (not params): asyncpg doesn't support parameterized SET statements
- Response enrichment pattern: compute category_label inline during ChangeRecordResponse construction
- Absence-based read tracking: unread = no row in change_read_states for (user_id, change_id)
- useMemo for Set from server data: prevents useCallback deps changing on every render
- Optimistic TanStack update pattern: snapshot caches, setQueryData, return snapshot for onError rollback
- matched_parcel_id gating pattern: prefer verified ID over list/address
- Infinite scroll pattern: useInfiniteQuery + IntersectionObserver sentinel + pages.flatMap + has_more backend flag
- **text-on-accent**: all amber/accent-background elements use this utility
- **Defined grey scale**: only 100, 300, 400, 600, 700, 800, 850, 900, 950
- CBS WFS already integrated for gemeente/wijk boundaries
- ThemeProvider at src/lib/theme/ with localStorage persistence
- **Three-state contract**: return model | None (not-found/unconfigured) | raise GovernmentAPIError (error)
- **retry_with_backoff**: shared helper in base.py, wraps any async HTTP callable, 429-aware exponential backoff (1s/2s/4s)
- **MEDIUM/LOW confidence field comments**: API field names annotated for Phase 53 live validation
- **Step 2b sequential BRK pattern**: fetch_brk_ownership() runs after asyncio.gather completes, uses CadastralParcel.identificatie from PDOK
- **ClassVar[bool] never_cache marker**: BRKOwnership.never_cache = True — Pydantic excludes ClassVar from serialization; save layer checks this attribute before JSONB persist
- **BRK strip-before-assign**: model_dump() -> pop('brk_ownership', None) -> assign (pop before assign, not after)
- **BRK enriched copy**: dict(report.report_data) shallow copy for re-fetch — stored JSONB untouched, enriched copy returned in response
- **GovernmentAPIError signature**: GovernmentAPIError(source, message, status_code) — source is first positional arg
- **Post-parallel enrichment**: RCE Linked Data detail fetched after asyncio.gather completes, not inside it (Phase 55)
- **Inner async def for cache-manager wrap**: `_fetch_rce_detail()` closure wraps Pydantic-returning client with `.model_dump()` for get_cached_or_fetch compatibility (Phase 55)
- **Parcel report idempotency**: `saved_reports.source_parcel_id` + active unique index ensures one active report per parcel/org; repeated `/from-parcel` returns existing report

### Ongoing TODOs

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

### Decisions (v7.0)

- All external-API schema fields use | None defaults — EP-Online/WOZ/RCE field names are MEDIUM/LOW confidence, Phase 53 validates live
- BRKOwnership module docstring has Kadaster Tier 3 caching prohibition — critical legal compliance note
- RCEMonumentDetail added to monument.py (not a new file) — enriches MonumentStatus, belongs in monument domain
- INF-05 completeness denominator 6->9 deferred to Phase 55 — changing without wiring new sections gives wrong scores
- BRK intentionally absent from CACHE_TTL — Kadaster Tier 3 terms prohibit caching BRK data
- EP_ONLINE_API_KEY uses empty string default (graceful degradation, same as BAG/DSO pattern)
- Rate limits: ep_online(3/500), rce_detail(3/300) — conservative for public/key-gated APIs
- EP-Online 404 returns EnergyLabel(is_geregistreerd=False) not None — normal for 20-30% of properties (NRG-03)
- WOZ low_confidence=True always set (WOZ-04) — public Waardeloket, not authoritative API
- WOZ unexpected format raises GovernmentAPIError not silent None — monitoring requirement
- RCE SPARQL not available (serviceCount=0 on all public RCE datasets) — replaced with linked-node HTTP fetching
- RCE omschrijving uses ceo:omschrijving predicate (not redengevendeOmschrijving) in Omschrijving nodes
- RCE functie label via heeftFunctieNaam -> SKOS prefLabel (lang=nl), not URI path segment
- RCE three async calls per monument: REST API + dereference + omschrijving node (+ optional functie node)
- URL-dispatch mock pattern (_make_http_client_with_url_dispatch) for multi-step HTTP clients in tests
- api_mocks.make_mock_response uses 'json_data or {}' — empty list requires direct MagicMock construction
- BRK three-state status (available/unavailable/error) over boolean is_beschikbaar — explicit, frontend-consumable (Phase 54)
- Single mTLS client for all percelen per aggregation call — avoids repeated SSL handshakes (Phase 54)
- No Redis cache for BRK — safest Kadaster Tier 3 interpretation (Phase 54)
- ClassVar[bool] never_cache on BRKOwnership — save layer must pop brk_ownership from model_dump before JSONB persist (Phase 54)
- Strip-before-assign (not assign-then-pop): pop must happen before assigning to report.report_data (Phase 54)
- GET re-fetch uses stored cadastral_parcels from JSONB — avoids full re-aggregation, fast live BRK lookup (Phase 54)
- No extra rate limiter wrapper in aggregator — rce_detail_limiter applied inside client method, not at call site (Phase 55)
- monument_nummer converted to str() before RCE client call — client expects string (Phase 55)
- Enrichment only triggers for consensus_status == 'rijksmonument' — avoids unnecessary API calls (Phase 55)
- cache source 'rce_detail' (not 'rce') matches CACHE_TTL key and 30-day TTL (Phase 55)
- energy_label is not None covers both is_geregistreerd=True and is_geregistreerd=False — None means unconfigured/unavailable (Phase 55 Plan 02)
- woz_data is not None for completeness — None means 404 (no WOZ object, normal) (Phase 55 Plan 02)
- brk_ownership.status == 'available' for completeness — BRKOwnership always present, use status check (Phase 55 Plan 02)
- fetch_energy_label() None-guards verblijfsobject_id — some addresses lack VBO ID (Phase 55 Plan 02)
- fetch_woz_data() uses nummeraanduiding_id without None guard — always present on BAGAddressResponse (Phase 55 Plan 02)

### Decisions (v7.1)

- Keep one app and layer persona-specific workspace framing via shared context (no app clone now).
- Municipality monitoring remains opt-in per gemeente to prevent external API overcapacity.
- Scope model is explicit and sequential: provincie -> gemeente -> wijk -> perceel -> actie.

### Decisions (v7.2 Planning)

- No dedicated "opportunity mode" toggle as separate workflow; intelligence must surface in the base report/map contract.
- Buildability Delta is first priority because it answers the core developer question ("hoeveel kan hier nog?").
- Wkb is staged as Layer A auto-precheck (default) plus optional Layer B refinement (not a forced wizard flow).
- Permit precedents start with pragmatic v1 scope: same municipality + comparable permit type + recent time window.

### Decisions (v7.2 Execution)

- Buildability Delta is a first-class report/map contract (`buildability_delta`) with explicit confidence and missing fields.
- Wkb precheck is always generated as Layer A output in each report payload (`wkb_precheck`), no wizard dependency.
- Layer B refinement is modeled as optional contract metadata in the same payload and can refine status/confidence when provided.

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-02-27T00:00:00Z
**Stopped At:** v7.2 shipped (59/60/61 complete)
**Resume File:** .planning/ROADMAP.md

**Next Action:** Define and execute next milestone phase plan (starting from product validation and UX workflow hardening).

---

*State updated: 2026-02-27 — v7.2 phases 59-61 completed and shipped*
