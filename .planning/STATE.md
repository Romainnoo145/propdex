# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v7.0 Deep Property Data — enriching reports with WOZ, energielabel, BRK, and RCE data

---

## Current Position

Phase: 53 — API Clients
Plan: 2/3 complete
Status: Plan 53-02 complete — RCE Linked Data client with JSON-LD parsing and live API validation
Last activity: 2026-02-24 — Phase 53 Plan 02 complete (RCE Linked Data client)

---

## Performance Metrics

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

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-02-24T05:02:14Z
**Stopped At:** Completed 53-02-PLAN.md
**Resume File:** .planning/phases/53-api-clients/53-02-SUMMARY.md

**Next Action:** Execute Phase 53 Plan 03 (BRK client)

---

*State updated: 2026-02-24 — Phase 53 Plan 02 complete (RCE Linked Data client with live API validation)*
