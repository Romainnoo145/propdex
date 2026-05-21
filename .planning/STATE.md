---
gsd_state_version: 1.0
milestone: M052
milestone_name: Hauzer Engagement-Demo
status: roadmap_complete
stopped_at: M052 roadmap complete 2026-05-21 — 6 slices (S01→(S02∥S03∥S04∥S05)→S06), 23 reqs mapped. Ready for per-slice build. Next: /plan-eng-review M052/S01 → /gsd:plan-phase 1.
last_updated: "2026-05-21T13:15:00.000Z"
last_activity: 2026-05-21
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Propdex — GSD State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 — M052 Hauzer Engagement-Demo, System-of-Engagement pivot)

**Core value:** System-of-Engagement — Propdex als dagelijkse werkplek van de makelaar/ontwikkelaar, niet eenmalige datakaart. Kaart+data = magneet, dagelijkse workflows+acties = lijm (retentie). Intelligence-first across full lifecycle.
**Current focus:** M052 Hauzer Engagement-Demo — engagement-laag (kernproduct) in productie bouwen op echte Venlo-data, demo-isolatie via demo-org + `HAUZER_DEMO`-flags. Hauzer = beoogde launching-partner (demo-first, nog niet gepitcht). Defining requirements → roadmap.

## Current Position

Milestone: M052 Hauzer Engagement-Demo — 🆕 STARTED 2026-05-21. Requirements (23) + roadmap (6 slices) compleet. Ready for per-slice build.
Approach LOCKED 2026-05-21: in productie bouwen (geen wegwerp-demo); ~80% = echt kernproduct; demo-isolatie via demo-org seed + `HAUZER_DEMO` feature-flags; alleen Hauzer-API-features (Realworks/nieuwbouw-matcher) puur mock tot post-deal.
Slice-volgorde: S01 (Fundament+flag) → (S02 acquisitie-arc ∥ S03 Dashboard ∥ S04 Contact-teaser ∥ S05 Discovery) → S06 (seed+verificatie).
Next action: per CLAUDE.md drie-laags — `/plan-eng-review M052/S01` (+ design-review voor UI-zware S02-S05) vóór `/gsd:plan-phase 1`.
Prev milestone: M050 BRK Lookup-Wedge — ✅ SHIPPED + ARCHIVED 2026-05-21 (tag M050), 22/22 reqs.
Still open (defined, not started — NOT dropped): M051 Brief-Send Pipeline (gated op Kadaster-DPA + PostNL legal — grote Hauzer-pré; M052 toont het als fake-write teaser) · M050.5 Feature Tiering (parallel-runnable).
Last activity: 2026-05-21

Progress: [░░░░░░░░░░] 0% — requirements + roadmap in opbouw

⚠ Pre-existing (NOT M052): woonvisie `rescore_parcels_for_document` job + m045 cascade endpoints have 3 failing + 5 erroring tests on `main` (`get_affected_parcel_ids` returns empty). Confirmed failing on clean tree. Known-issue todo, geen M052-scope — maar telt zwaarder nu engagement-laag in productie landt (groene main-CI). Needs separate investigation.

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Cache Sentinel | TBD | - | - |
| 2. Score UI Fix | TBD | - | - |
| 3. Woonvisie Popup | TBD | - | - |
| 4. KlimaatLayer Bug | TBD | - | - |

*Updated after each plan completion*
| Phase 01-cache-sentinel P01 | 37m | 2 tasks | 3 files |
| Phase 02-score-ui-fix P01 | 11m | 2 tasks | 2 files |
| Phase 02-score-ui-fix P02 | 4m | 1 tasks | 1 files |
| Phase 05-document-level-cache-sentinel-woonvisie P01 | 33m | 6 tasks | 7 files |
| Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade P01 | 4m 18s | 5 tasks | 6 files |
| Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade P02 | 9m | 2 tasks | 4 files |
| Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade P03 | 5m | 1 tasks | 1 files |
| Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade P04 | 26 min | 2 tasks | 1 files |
| Phase 03-woonvisie-popup P01 | 12m | 2 tasks | 3 files |
| Phase 03-woonvisie-popup P02 | 20m | 3 tasks | 2 files |
| Phase 04-klimaatlayer-bug P01 | 5m | 3 tasks | 2 files |
| Phase 07-factor-pinning-groep-pages-6-cards-per-page P01 | 5m | 3 tasks | 9 files |
| Phase 07-factor-pinning-groep-pages-6-cards-per-page P03 | 22m | 2 tasks | 3 files |
| Phase 07-factor-pinning-groep-pages-6-cards-per-page P02 | 45 minutes | 3 tasks | 8 files |
| Phase 07-factor-pinning-groep-pages-6-cards-per-page P04 | 6min | 3 tasks | 4 files |
| Phase 07-factor-pinning-groep-pages-6-cards-per-page P05 | 10m | 1 tasks | 1 files |
| Phase 08-integration-tests-venlo-e2e-smoke P01 | 38m | 10 tasks | 5 files |
| Phase 01-datamodel-source-key-catalog P01 | 4 min | 3 tasks | 4 files |
| Phase 01-datamodel-source-key-catalog P02 | 11 min | 3 tasks | 5 files |
| Phase 02-admin-api-layer P01 | 8m | 2 tasks | 6 files |
| Phase 02-admin-api-layer P02 | 132 min | 1 tasks | 3 files |
| Phase 03-data-sources-ux P02 | 5min | 1 tasks | 1 files |
| Phase 03-data-sources-ux P01 | 2min | 2 tasks | 2 files |
| Phase 03-data-sources-ux P03 | 6min | 3 tasks | 6 files |
| Phase 03-data-sources-ux P04 | 7min | 3 tasks | 5 files |
| Phase 04-m045-upload-flow-integratie P03 | 1m | 1 tasks | 1 files |
| Phase 04-m045-upload-flow-integratie P04-01 | 1m 15s | 1 tasks | 1 files |
| Phase 04-m045-upload-flow-integratie P02 | 9min | 1 tasks | 1 files |
| Phase 04-m045-upload-flow-integratie P05 | 6m | 2 tasks | 4 files |
| Phase 04-m045-upload-flow-integratie P04 | 7min | 2 tasks | 3 files |
| Phase 04.1-manual-upload-rescore P01 | 8min | 3 tasks | 6 files |
| Phase 04.1-manual-upload-rescore P02 | 4min | 1 tasks | 3 files |
| Phase 05-encrypted-credentials P05-01 | 6m | 3 tasks | 11 files |
| Phase 05-encrypted-credentials P05-02 | 4m | 2 tasks | 5 files |
| Phase 05-encrypted-credentials PP05-03 | 30min | 3 tasks tasks | 6 files files |
| Phase 06-actionitems-deprecation P06-01 | 6m | 3 tasks | 5 files |
| Phase 06-actionitems-deprecation P06-02 | 8m | 4 tasks | 9 files |
| Phase 06-actionitems-deprecation P06-03 | 9m 45s | 2 tasks | 2 files |
| Phase 07-visual-qa-aura-conformance P01 | 4m | 2 tasks | 2 files |
| Phase 06-opgeslagen-cockpit-lifecycle-sidebar P01 | 4 | 2 tasks | 3 files |
| Phase 06-opgeslagen-cockpit-lifecycle-sidebar P06-03 | 35m | 3 tasks | 5 files |
| Phase 06-opgeslagen-cockpit-lifecycle-sidebar P02 | 2min | 1 tasks | 1 files |
| Phase 06-opgeslagen-cockpit-lifecycle-sidebar P04 | 7min | 3 tasks | 4 files |
| Phase 06-opgeslagen-cockpit-lifecycle-sidebar P05 | ~2h | 3 tasks | 6 files |
| Phase 01-brk-datamodel-retention P01 | 3m 30s | 1 tasks | 3 files |
| Phase 01-brk-datamodel-retention P02 | 7m 14s | 3 tasks | 7 files |
| Phase 01-brk-datamodel-retention P03 | 12m 38s | 3 tasks | 10 files |
| Phase 02-brk-fetch-persist-endpoint P01 | 2m 37s | 3 tasks | 4 files |
| Phase 02-brk-fetch-persist-endpoint P02 | 5m 41s | 2 tasks | 3 files |
| Phase 02 P03 | 16m 35s | 3 tasks | 10 files |
| Phase 03-scoring-factoren-cascade P01 | 6m | 3 tasks | 5 files |
| Phase 03-scoring-factoren-cascade P02 | 7m | 3 tasks | 6 files |
| Phase 03-scoring-factoren-cascade P03-03 | 22m | 3 tasks | 11 files |
| Phase 08-brk-fase-2-wire-up P04 | 9m | 2 tasks | 5 files |
| Phase 08-brk-fase-2-wire-up P01 | 9m 54s | 3 tasks | 6 files |
| Phase 08-brk-fase-2-wire-up P06 | 17min | 4 tasks | 13 files |
| Phase 08-brk-fase-2-wire-up P07 | 8m 3s | 2 tasks | 5 files |
| Phase 08-brk-fase-2-wire-up P02 | 8m 41s | 3 tasks | 7 files |
| Phase 08-brk-fase-2-wire-up P03 | 9m 51s | 3 tasks | 9 files |
| Phase 08-brk-fase-2-wire-up P05 | 35m 40s | 4 tasks | 9 files |
| Phase 08-brk-fase-2-wire-up P08 | 9m 46s | 3 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

- 2026-05-19: Phase 8 added (M050/S06 cont.): BRK Fase-2 Wire-up. Verplaatst BRK persist-CTA van fase 1 (Onderzoek) naar fase 2 (Contact); nieuw GET /api/parcels/{id}/brk endpoint; split FavoriteParcelWorkspaceView (1922 LOC) in ≤300-LOC componenten. Triggered door /plan-eng-review die ontdekte dat Phase 6 (cockpit shell) al verified-shipped was maar BRK-functionaliteit nooit gewired werd. Eng-plan LOCKED: `.planning/milestones/M050-S06-ENG-PLAN.md` + gespiegeld als `.planning/phases/08-brk-fase-2-wire-up/08-ENG-PLAN.md`.
- 2026-05-16: Phase 04.1 inserted after Phase 4 (M049/S04): Manual Upload Rescore Wire-up (URGENT) — close cascade re-score gap for admin-uploaded PolicyDocuments. Goal: parity with weekly auto-ingest cron; source_key-agnostic enqueue auto-picks up M050+ extractors. Discovered during M049/S04 cascade-wiring audit.
- 2026-04-22: M048 created with 4 phases (Cache Sentinel, Score UI Fix, Woonvisie Popup, KlimaatLayer Bug)
- 2026-04-24: Office hours scope expansion — 4 new phases added from design doc 20260424-200512:
  - Phase 5: Document-level cache sentinel (woonvisie)
  - Phase 6: WijkPolicy schema + woonvisie scoring upgrade
  - Phase 7: Factor pinning + groep-pages + 6 cards per page
  - Phase 8: Integration tests + Venlo E2E smoke
- 2026-04-24: Dependencies restructured per design doc parallelism — `1 → 2 → (5 ∥ 4) → (6 ∥ 3) → 7 → 8`
- 2026-04-24: Rapport-PDF cascade-native redesign explicitly out of M048 scope; deferred to M049+

### Decisions

- [2026-04-24 office hours]: User job in ParcelDetailModal = triage scan (5-20 sec). Top-3/6 hyperzichtbaar, rest secundair
- [2026-04-24 office hours]: Pinning mechanism = backend per-user (`user_factor_pins` tabel), niet localStorage, niet per-org
- [2026-04-24 office hours]: Pagination over collapse/accordion — 6 cards per page, 1 groep per page, pinned synth-page 1 met ⭐ indicator in groep-pages
- [2026-04-24 office hours]: FACTOR_REGISTRY krijgt `category` veld voor UI-groepering — metadata-only, geen runtime-logica wijziging
- [2026-04-24 office hours]: Rapport-PDF redesign = eigen milestone. App-view en rapport blijven tijdelijk inconsistent (lappendeken bewust geaccepteerd)
- [Pre-M048]: SCHEMA_VERSION bump (1→2) — M047/S04 + S06 introduced new pipeline; cache must invalidate
- [Pre-M048]: potentie_risico_balance as frontend prop, NOT from scan flags — flags is scan-data, balance is org-config
- [Pre-M048]: Woonvisie popup on kaart 10 click, not ScoreBreakdownModal rebuild — targeted fix, rebuild deferred post-M050
- [Pre-M048]: percentage_of_category data-contract — backend exposes %, frontend never renders raw gewicht integer
- [Phase 01-cache-sentinel]: SCHEMA_VERSION bumped 1→2 (M048/Phase 1) to invalidate pre-M047 extraction cache entries
- [Phase 02-score-ui-fix]: potentieRisicoBalance as required prop on ScoreBreakdownModal — modal never reads org config internally
- [Phase 02-score-ui-fix]: No fallback from percentage_of_category to gewicht/100 — pre-M047 scans render no label (null silently hides)
- [Phase 02-score-ui-fix]: Dynamic flex via style={{ flex: N }} not Tailwind flex-[N] class (runtime values not purged by JIT)
- [Phase 02-score-ui-fix]: Storybook 10 test imports use 'storybook/test' not '@storybook/test' — package path changed in v10
- [Phase 02-score-ui-fix]: Portal-rendered modals require within(document.body) in play functions — createPortal escapes canvasElement scope
- [Phase 05-document-level-cache-sentinel-woonvisie]: Phase 5: DOCUMENT_SENTINEL kept at caller-level (cascade_enrichment_service), not hoisted to FactorDefinition — defer registry-hoisting to M050 when 2nd document-level factor lands
- [Phase 05-document-level-cache-sentinel-woonvisie]: Phase 5: version-agnostic test guards (>= N or use SCHEMA_VERSION constant) — future bumps won't require per-test assertion edits
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6: version-agnostic SCHEMA_VERSION assertion (>= 3) — survives v3->v4 bump without per-version test edits
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6: Wave-0 stubs intentionally fail with ImportError on WijkPolicy — explicit Nyquist signal driving Plan 06-02 implementation
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6: v3->v4 cache-miss test mirrors Phase-5 v2->v3 pattern exactly (same fixture, same imports, same assertion shape)
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6: WijkPolicy Pydantic model lives inline in woonvisie_match.py (no new module); deprecated fields retained on payload for cache-roundtrip but removed from _INPUT_SCHEMA + prompt so Claude stops emitting them
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6: top-level tool-use required narrowed from 5 to 3 fields ([periode_start, periode_einde, confidence]); wijk_policies + algemeen_citaat optional so vague documents still extract
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6: SCHEMA_VERSION bumped 3->4; no Alembic migration (Phase-5 pattern); pre-existing version-pinned test assertions rewritten to version-agnostic (SCHEMA_VERSION constant reference or >= N) to honor the Phase-6 lock
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6 / Plan 03: longest-normalised-name wins for WijkPolicy match — deterministic over Claude list-order; Blerick-Noord beats Blerick when both present
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6 / Plan 03: FactorResult.waarde migrated from legacy string to dict {matched_wijk, matched_policy, prioritized_segment, algemeen_citaat} — WoonvisiePopup consumes directly
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6 / Plan 03: _PRIORITEIT_SCORE_DELTA locked (groei=+3.0, herstructurering=+1.5, neutraal=0.0, krimp=-2.5); deprecated WoonvisiePayload fields (growth_wijken/shrink_wijken/etc) no longer read by scorer — retained on model for cache-roundtrip only
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6 / Plan 04: deprecated-field keyword-arg construction (growth_wijken/shrink_wijken/excluded_project_types) fully purged from integration tests — test surface now matches Plan-06-02 schema authoritatively
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6 / Plan 04: Venlo smoke-test asserts >= 0.2 score-differentiation between Blerick (groei+sociaal+midden overlap) and Venlo-Centrum (neutraal+duur+gemengd no-overlap) for project_type=nieuwbouw_wonen — validates the whole point of Phase 6 in one assertion
- [Phase 06-wijkpolicy-schema-woonvisie-scoring-upgrade]: Phase 6 / Plan 04: Frontend audit captured PotentieLayer.tsx as the only consumer of woonvisie_match.waarde (reads .prioritized_segment) — Phase 3 WoonvisiePopup work now has concrete TypeScript-type-update target list
- [Phase 03-woonvisie-popup]: Phase 03 Plan 01: periode_start/einde default to 0 — Phase 6 factor.waarde omits period fields; meta line shows '0-0' as known limitation
- [Phase 03-woonvisie-popup]: Phase 03 Plan 01: WoonvisiePopup only renders as button when hasWoonvisieData — graceful degradation for parcels without woonvisie_match factor
- [Phase Phase 03 Plan 02]: EscDismisses story uses Sluiten button (aria-label=Sluiten) not Escape key — WoonvisiePopup.tsx has no keydown listener; ESC gap documented as follow-up todo
- [Phase Phase 03 Plan 02]: PotentieLayer ClickOpensPopup navigates to page 2 first — woonvisie_match is card 10, CARDS_PER_PAGE=9 puts it on page 2; waitFor(2000ms) handles AnimatePresence transition
- [Phase 04-klimaatlayer-bug]: key={activePanel.code} on GemeenteContextPanel (not naam) — codes are stable identifiers, heals all four gemeente layers simultaneously
- [Phase 07]: Wave 0 Nyquist: ImportError on app.models.user_factor_pin is explicit signal driving Plan 02 — no pytest.skip/xfail allowed
- [Phase 07]: factorPinsMock uses inline TanStack Query cache pre-seed (queryClient.setQueryData) not MSW — matches Phase 3 precedent
- [Phase 07-03]: criminaliteit mapped to 'markt' (not 'sociaal') — avoids expanding 6-value Bron enum; marketability affected by criminaliteit
- [Phase 07-03]: capaciteit mapped to 'fysiek' inline in FACTOR_BRON — UI-only derived card (building_metrics), NOT in backend FACTOR_REGISTRY
- [Phase 07-03]: bron field REQUIRED on FactorRegistryEntry (no default) — module-load assertion is safety net; forces explicit thought when adding new factors
- [Phase 07-factor-pinning-groep-pages-6-cards-per-page]: Check-before-insert instead of catch-IntegrityError: avoids SQLAlchemy async session rollback/greenlet issues on Python 3.14 + asyncpg; matches auth_service.py project pattern
- [Phase 07-factor-pinning-groep-pages-6-cards-per-page]: statement_cache_size=0 + pool_pre_ping=False in test_engine: fixes asyncpg DDL prepared-statement cache bug (Python 3.14 + asyncpg + SQLAlchemy 2.x pg_type UniqueViolation between tests)
- [Phase 07-04]: bodemtype added to FACTOR_BRON as UI-only 'fysiek' entry for BODEMTYPE env card — not in backend FACTOR_REGISTRY
- [Phase 07-04]: envCards label→factor_key map is inline keyMap in deriveEnvCards — avoids exported constant that must sync with enrichment labels
- [Phase 07-05]: ClickOpensPopup story updated to querySelectorAll('[role=button], button') after Plan 04 FactorCard refactor changed interactive cards to div[role=button]
- [Phase 07-05]: CARDS_PER_PAGE dropped 6→4 with 2x2 grid; MAX_PINS_PER_CATEGORY dropped 6→4 — steady-state M050-M057 factor projection shows 5 categories overflow at 4/page anyway; 4/page accepts overflow as normal pattern, gives titles room in 620px panel
- [Phase 07-05]: Score badge stays top-right in flex cluster with items-center — earlier overlap was absolute-positioned star + items-start; fix: collapse star+badge into single right-side cluster
- [Phase 07-05]: No 'bekijk meer →' hover CTA — only woonvisie_match is currently clickable; deferred to M049+ when all cards have factor-detail destinations
- [Phase 07-05]: Pin star always visible (slate-300 outline default, amber when pinned) — hover-only is anti-pattern on touch; persistent star communicates intent without requiring hover
- [Phase 07-05]: Drill-down indicator = subtle ArrowRight bottom-right of cards with onCardClick (only woonvisie_match for now) — minimalistic affordance, no text label, signals clickability without hijacking visual hierarchy
- [Phase 08-integration-tests-venlo-e2e-smoke]: Storybook = convergence smoke layer (NOT Playwright); component-level pin remount survival is the proxy for live-refresh which is deferred to human verification
- [Phase 08-integration-tests-venlo-e2e-smoke]: Sentinel substitution at cascade boundary spy-tested via monkeypatch on cascade_enrichment_service.extract_factor (caller-side binding, NOT factor_extraction_service)
- [Phase 08-integration-tests-venlo-e2e-smoke]: _VENLO_BLERICK_CENTRUM_PAYLOAD inline in test_m048_phase8_smoke.py — NOT relocated to tests/factories.py (out of scope)
- [Phase 08-integration-tests-venlo-e2e-smoke]: Plan path 'app.services.factor_extraction_service.get_claude_client' was incorrect — does not exist; corrected to 'app.ai.factor_extractor.create_claude_client' returning SimpleNamespace(client, model) wrapper
- [Phase 08-integration-tests-venlo-e2e-smoke]: Pin-persistence component-level only; live-backend hard-refresh deferred to human verification block in 08-VERIFICATION.md
- [Phase 08-integration-tests-venlo-e2e-smoke]: Frontend Wave-0 stub task (T7) added to enforce Nyquist parity with backend Task 1
- [Phase 01-datamodel-source-key-catalog]: M049/S01 P01: catalog deliberately separate from M045 source_keys (eng-review lock-in 2026-05-14) — avoid naming-confusion cascade-level vs data-source-type
- [Phase 01-datamodel-source-key-catalog]: M049/S01 P01: 42 entries shipped (20 Type-A + 17 Type-B + 5 Type-C) — exceeds >=27 floor, captures full landscape now
- [Phase 01-datamodel-source-key-catalog]: M049/S01 P01: kebab-case regex relaxed to allow leading digit (3d-bag canonical key); TS-sync path resolution fixed to parents[3]
- [Phase 01-datamodel-source-key-catalog]: M049/S01 P02: vendor-managed DataSourceStatus model — NO TenantMixin / organization_id (eng-review 2026-05-14 lock-in); RBAC at route layer via Depends(get_current_superuser)
- [Phase 01-datamodel-source-key-catalog]: M049/S01 P02: alembic revision 657143b79099 (down_revision 3d1196c58771 = M048/S04 head, NOT stale CONTEXT bbdb5c6ff811); status enum lives in Pydantic Literal — DB column plain String(20) to avoid Postgres ENUM migration friction
- [Phase 02-admin-api-layer]: M049/S02 P01: AreaScan seed helper omits org_id — AreaScan uses Base+TimestampMixin (no TenantMixin), no organization_id column
- [Phase 02-admin-api-layer]: M049/S02 P01: compute_actions() inline in router (not separate registry) — 4 source_types x 2-3 status variants fits 30 lines, no over-engineering
- [Phase 02-admin-api-layer]: blake2b stable hash for pg advisory lock key (PYTHONHASHSEED-safe); is_global=True filter in Type A probe; sequential concurrent test (asyncio.gather + shared test_db breaks SQLAlchemy)
- [Phase 03-data-sources-ux]: 03-02: Type-check deferred for Link to='/instellingen/data-bronnen' until route lands in 03-04 — only 2 TS2322 errors on new Link to prop, all other errors pre-existing
- [Phase 03-data-sources-ux]: 03-02: fuzzy: true on matchRoute ensures pill stays active on /instellingen/data-bronnen AND /instellingen/data-bronnen/$gemeenteCode sub-route
- [Phase 03-data-sources-ux]: lib/queries/ directory created as new sub-namespace for domain-scoped query hooks (distinct from src/hooks/ component-level)
- [Phase 03-data-sources-ux]: Dual cache invalidation on refresh: both gemeente(code) and gemeenten() keys invalidated so picker status-dots update immediately
- [Phase 03-data-sources-ux]: No @/components/ui/tooltip (Radix/shadcn) — created ui/Tooltip.tsx using project CSS group/group-hover pattern per TeamAttributionBadge.tsx convention
- [Phase 03-data-sources-ux]: motion layoutId='gemeente-picker' is isolated scope from SettingsTabNav's 'settings-tab' — prevents cross-tab animation interference
- [Phase 03-data-sources-ux]: Upload action renders as TanStack Link (not button) when enabled — deep-links to /instellingen/beleid-beheer per 03-CONTEXT §12 until S04 adds modal in-place
- [Phase 03-data-sources-ux]: Route codegen: @tanstack/router-generator Generator class (not tsr CLI — lacks entrypoints config)
- [Phase 03-data-sources-ux]: Stories use real routeTree + AuthContext.Provider: matches BottomTabNav.stories.tsx project pattern for auth-aware components
- [Phase 03-data-sources-ux]: noUncheckedIndexedAccess: gemeenten[0]?.gemeente_naam with nullish coalescing — strict tsconfig requires optional chaining on index access
- [Phase 04-m045-upload-flow-integratie]: INT-03 banner: BeleidBeheerWithBanner wrapper at route level keeps migration notice separate from InstellingenBeleidPage component; no redirect logic — banner is informational only until M050
- [Phase 04-m045-upload-flow-integratie]: 04-01: All three new UploadDocumentModal props are optional — InstellingenBeleidPage call site requires no changes
- [Phase 04-m045-upload-flow-integratie]: resolvedEntityType/resolvedEntityCode derived from gemeenteCode shorthand before hook call — shorthand sets entityType='gemeente' implicitly for all Type-A cascade documents
- [Phase 04-m045-upload-flow-integratie]: VersionHistoryPanel modal-overlay retrofit: VersionRows extracted inner component eliminates JSX duplication; ModalShell wraps loading+error+success states when onClose present; open===false guard after hooks per React rules
- [Phase 04-m045-upload-flow-integratie]: helpers extracted to data_sources_helpers.py to break circular import between router and orchestrator
- [Phase 04-m045-upload-flow-integratie]: orchestrator rebuilds only cascade_uploads (Type A) after probe — open_apis and paid_integrations unchanged
- [Phase 04-m045-upload-flow-integratie]: 04-04: Hooks before early-returns in GemeenteDataSourcesPage — useQueryClient/useRefreshDataSource/useState placed before loading/error guards per React rules of hooks
- [Phase 04-m045-upload-flow-integratie]: 04-04: GemeenteSummary→GemeenteEntry conversion at call site with provincie_code='' sentinel; handleUploadSuccess double-flush: invalidateQueries + refreshMutation.mutate for INT-04 probe trigger
- [Phase 04.1-manual-upload-rescore]: CASCADE_RESCORE_SOURCE_KEYS lives in rescore_cascade_job.py as single gate — M050+ adds source_keys here only, no other wire changes needed
- [Phase 04.1-manual-upload-rescore]: upload_enqueue.py extracted from router.py to satisfy 300-line rule (301→295 lines); best-effort enqueue pattern (try/except, warnings not raises)
- [Phase 04.1-manual-upload-rescore]: Integration tests: app.state.arq_pool = mock_pool in try/finally (not monkeypatch.setattr on async_client.app) — httpx AsyncClient has no .app attribute
- [Phase 04.1-manual-upload-rescore]: 04.1-02: File split at domain boundary (upload vs probe) without conftest.py — helpers with a single consumer stay in that consumer's file; ruff import-sort and unused-variable fix applied as part of split
- [Phase 05-encrypted-credentials]: M049/S05 Plan 01: down_revision = b2a4f6c8e1d3 (current head from Phase 04.2), NOT stale 657143b79099 referenced in plan — Rule 3 auto-fix
- [Phase 05-encrypted-credentials]: M049/S05 Plan 01: Lazy MultiFernet built on first encrypt/decrypt call + reset_cache() test hook — tests monkeypatch settings before first use without import-time wiring
- [Phase 05-encrypted-credentials]: M049/S05 Plan 01: AuditLog Python attr event_metadata maps to DB column 'metadata' (DeclarativeBase reserves the bare attribute name)
- [Phase 05-encrypted-credentials]: M049/S05 Plan 02: _to_read() helper centralises secret-stripped projection — defends TEST-03c regression long-term
- [Phase 05-encrypted-credentials]: M049/S05 Plan 02: DELETE atomicity — db.add(audit) + db.delete(row) + single commit; no orphan audit on rollback
- [Phase 05-encrypted-credentials]: M049/S05 Plan 02: source_key path validation loose (Annotated[str, Path]); CREDENTIAL_FIELDS membership is single source of truth (404 GET, 422 POST)
- [Phase 05-encrypted-credentials]: M049/S05 Plan 03: manual TS-twin of CREDENTIAL_FIELDS (kebab-case object literal, same precedent as dataSourceKeys.ts) — backend + frontend updated in lockstep when M050+ adds source_keys
- [Phase 05-encrypted-credentials]: M049/S05 Plan 03: dedicated ActionButton render branch for configure_credential (not generic handleClick switch) — keeps refresh spinner state isolated and per-action UX explicit
- [Phase 05-encrypted-credentials]: M049/S05 Plan 03: rotate flow via DELETE → invalidateQueries (per-sourceKey) → form auto-re-renders empty — no manual state reset needed because state derives purely from GET cache
- [Phase 05-encrypted-credentials]: M049/S05 Plan 03: EmptyField/FilledField sub-components inline in CredentialConfigModal.tsx (275 lines, < 300-line rule) — no folder-split required
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-01: ActionItems content migrated to backend ACTION_ITEMS_CATALOG (6 gemeente-bound) + INFRASTRUCTURE_ACTION_ITEMS (12 orphans); ActionItem DB entity untouched (zero new migrations); compute_actions signature extended with source_key arg
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-01: view_action_item action always enabled when source_key in ACTION_ITEMS_CATALOG (no source_type/status gating); test fixture welstandsnota chosen because it is both Type-A and in catalog
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-02: ACTION_ITEMS_CATALOG TS-twin verified via 1-shot Python drift script (6/6 catalog keys + 12/12 infra ids match backend verbatim); pattern: import type from lib/types, Record<string, Entry>, JSDoc names backend file
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-02: /instellingen/action-items SPA-redirect route has NO superuser gate — target /instellingen/data-bronnen owns auth; avoids double-redirect for non-superusers
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-02: ActionItemDetailModal uses AnimatePresence-wrapped conditional render (open && entry !== null) — hooks-before-return safe, exit animations work, null sourceKey renders nothing
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-03: 4 backend e2e smoke tests (3 pass + 1 skip for missing ActionItem DB model) + 1 WithActionItem Storybook play function; CI grep guard against stray /action-items links + routeTree.gen.ts assertion + DB entity audit; welstandsnota used in T1 + WithActionItem story over plan's woonvisie because welstandsnota IS in ACTION_ITEMS_CATALOG (same correction as 06-01)
- [Phase 06-actionitems-deprecation]: M049/S06 Plan 06-03: DataSourceRow.stories.tsx is NOT in vitest-storybook run (.storybook/main.ts globs only src/stories/**) — WithActionItem play function verified via type-check + structural parity with 4 existing play functions in same file; manual UI execution via npm run storybook on port 6006
- [Phase 07-visual-qa-aura-conformance]: M049/S07 Plan 07-01: BeleidBeheerWithBanner banner Link conditionally renders /instellingen/data-bronnen/$gemeenteCode deeplink (with params) when useGemeentenSummary().data?.[0]?.gemeente_code is truthy; falls back to /instellingen/data-bronnen index Link otherwise — INT-03 gap closed
- [Phase 07-visual-qa-aura-conformance]: M049/S07 Plan 07-01: Storybook play-function coverage via local presentational twin in stories file (route file stays source of truth in production) — same precedent as M049/S03 DataSourceRow.stories.tsx; .storybook/main.ts globs only src/stories/**, verification via type-check + structural parity
- [Phase 07-visual-qa-aura-conformance]: M049/S07 Plan 07-01: Pre-existing 91 TS errors baseline (stash-verified pre/post-change identical) deferred to dedicated TS-strict-cleanup phase per scope-boundary policy; this plan introduces zero new errors
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: Onderzoek icon links to /opgeslagen (list-view home) — doubles as home affordance; Plan 04 does NOT swap this target
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: search={{ stage: undefined }} required on /opgeslagen Link — opgeslagen route validateSearch enforces stage param at TypeScript level (Rule 3 auto-fix)
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: lifecycle-sidebar-active layoutId namespace separate from sidebar-active in SideRailNav — prevents cross-component animation interference
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: PipelineStagePill extended with discriminated-union API (parcelId+currentStage=dropdown vs stage+onClick=display) to preserve backward compat with existing callers
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: Score modals lifted to OpgeslagenPage level (single PotentieModal+RisicoModal) not per-card to avoid N portal elements
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: GemeenteGroupAccordion extraction deferred — opgeslagen.tsx at 318 lines within <350 plan limit; follow-up todo created
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: 06-02: activePhaseKey='1-onderzoek' hardcoded for v1 in layout swap — Plan 04 derives from route params when nested perceel routes land
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: 06-02: fuzzy: true on matchRoute covers /opgeslagen list view AND all future /opgeslagen/* sub-routes — no changes needed to _authenticated.tsx in Plan 04
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: FavoriteParcelWorkspaceView actual props { favorite, onBack, onOpenMap } — plan spec wrong; adapted call site without touching component
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: routeTree.gen.ts updated manually since vite codegen only runs in dev/build; registers both new routes with parent-child hierarchy
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar]: beforeLoad + throw redirect() pattern used for 1-onderzoek slug redirect — avoids in-render navigate() and StrictMode warnings
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar / 06-05]: LifecycleSideRailNav scope corrected to matchRoute('/opgeslagen/perceel/$parcelId') — fuzzy '/opgeslagen' was too broad; list view stays on standard SideRailNav
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar / 06-05]: ReducedMotionDegrades story uses CSS decorator (animation-duration: 0.01ms override) not Storybook viewport — OS media query cannot be forced from Storybook
- [Phase 06-opgeslagen-cockpit-lifecycle-sidebar / 06-05]: M048 UX nits (pin jump, ghost-arrow pagination) logged as separate todo — NOT S06 regressions; scope boundary maintained
- [Phase 01-brk-datamodel-retention]: M050/S01 P01: ix_brk_ownership_records_organization_id explicitly declared in migration (parity with TenantMixin index=True) — Alembic schema matches create_all output, no drift between dev DB and test-fixture DB
- [Phase 01-brk-datamodel-retention]: M050/S01 P01: raw_brk_response typed as dict[str, object] | None (not bare dict) — new-code baseline stricter than existing 25 pre-existing mypy [type-arg] errors in models/
- [Phase 01-brk-datamodel-retention]: M050/S01 P01: Alembic revision = readable slug '20260518_m050_s01' (Alembic accepts arbitrary unique strings) — first migration under new date-based naming convention
- [Phase 01-brk-datamodel-retention]: M050/S01 P02: ParcelFavorite is user-scoped (no organization_id column) — D3 hook + find_orphaned_records resolve org_id via User.organization_id (Rule 1 plan-interface adaptation)
- [Phase 01-brk-datamodel-retention]: M050/S01 P02: M050_BRK_PERSIST_ENABLED=False default gates persist_record() only (D4 write-path-only) — read + retention always live, FeatureDisabled raised by service-layer
- [Phase 01-brk-datamodel-retention]: M050/S01 P02: strip_raw_brk_response recurses into list items (not only top-level filter) — defensive against nested natuurlijk_persoon inside deeper dicts; survivor dicts also scrubbed
- [Phase 01-brk-datamodel-retention]: M050/S01 P02: favorites D3 hook wrapped in try/except — never blocks favorite deletion on BRK soft-delete failure; orphan-cron is the safety-net (per ENG-PLAN D3 design)
- [Phase 01-brk-datamodel-retention]: M050/S01 P02: CursorResult[Any] cast pattern for UPDATE/DELETE rowcount under SQLAlchemy 2.x async — reusable for S02 persist write-path
- [Phase 01-brk-datamodel-retention]: M050/S01 P03: Mock-clock without freezegun — inject hard_delete_after = datetime.utcnow() - timedelta(days=1) directly into the row; project does not depend on freezegun; pattern reusable for S02 hard-delete window tests
- [Phase 01-brk-datamodel-retention]: M050/S01 P03: patched_cron_factory fixture monkeypatches async_session_factory in cron module to bind the production-DB factory to test engine — cron's own session sees test fixtures without DI refactor of the cron itself
- [Phase 01-brk-datamodel-retention]: M050/S01 P03: Phase 105 regression uses 404 path (unknown parcel_id) — proves no-row-written + no-persist_record-call without PDOK/PostGIS setup; happy-path is S02 territory
- [Phase 01-brk-datamodel-retention]: M050/S01 P03: Signature-drift regression guard via inspect.signature on get_parcel_eigendom — fails CI if anyone refactors the Phase 105 ephemeral endpoint under M050+ before AVG-Tier-3 re-review
- [Phase 02-brk-fetch-persist-endpoint]: M050/S02 Plan 02-01: vendor-managed credential resolver — NO organization_id filter on integration_credentials lookup; SOLE documented exception to CLAUDE.md multi-tenant rule (eng-review locks 2026-05-14/16)
- [Phase 02-brk-fetch-persist-endpoint]: M050/S02 Plan 02-01: TYPE_CHECKING forward-ref for BrkCredentials in brk_bevragen.py — keeps runtime import direction clean (resolver→model), typing import direction reversed (bevragen←resolver type only at type-check time)
- [Phase 02-brk-fetch-persist-endpoint]: M050/S02 Plan 02-01: build_brk_client(creds) accepts BrkCredentials but discards it today (_ = creds, # noqa: F841) — callsite shape locked for future env-key removal hardening pass (deferred per ENG-PLAN §NOT in scope)
- [Phase 02-brk-fetch-persist-endpoint]: D5 lock-key = hashlib.sha256(f'{uuid}:{parcel_id}').digest()[:8] → signed bigint — Python hash() per-process random, unsafe for cross-process advisory locks
- [Phase 02-brk-fetch-persist-endpoint]: D4 two-txn boundary inside single AsyncSession via db.commit() between phases — Txn1 lock+cache, HTTP outside any txn, Txn2 persist, quota hook AFTER Txn2 commit (non-blocking try/except)
- [Phase 02-brk-fetch-persist-endpoint]: D9 empty-list semantics — only-NatuurlijkPersoon upstream response returns 200 OK + [] (HTTP did happen, quota spent); cache-HIT path returns 200 OK + cached array without spending quota
- [Phase 02]: respx → monkeypatch(_call_kadaster) substitute: respx not installed; counter-dict pattern preserves request-level mocking semantics + avoids mTLS SSL test-env setup
- [Phase 02]: D14 iron rule pinned in TWO files (standalone signature_drift + Phase 105 extension) — eng-plan mandate honored; either file failing surfaces the drift
- [Phase 02]: Multi-tenant CRITICAL test_org_a_cannot_read_org_b_records green at service-layer (get_latest_for_parcel returns [] for cross-org); cross-org parcel-existence pre-check at endpoint layer remains a future hardening item (CrossOrgParcelAccess class in place but not raised)
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-01: M050_S03_FACTORS_ENABLED default False co-located with M050_BRK_PERSIST_ENABLED — both M050 flags side-by-side in config.py
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-01: BRKRecordDict TypedDict co-located in scoring_pipeline.py (NOT app/schemas/) — pure-function scoring layer stays Pydantic-free; Plan 03-02 imports the TypedDict directly
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-01: enrich_parcel_data_with_brk FF-off path does NOT insert 'brk_records' key — distinct from FF-on + zero rows (which inserts []). Factor functions short-circuit on key absence via parcel_data.get().
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-01: REGRESSION-CRITICAL F2 drift-detection executed end-to-end — removed organization_id filter → regression test failed with 'AVG breach: org_a saw 2 rows' → restored → 5/5 green. Iron-rule pattern verified.
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-02: 13 existing risico factors integer-rebalanced via _rebalance_risico_weights(target_sum=80) — largest-remainder method, alphabetical tie-break. 7 keys received +1 bonus (shortfall=7). Result pinned in REGRESSION-CRITICAL test #2.
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-02: D6 narrative-honesty enforced by banned-substring check (case-insensitive) on toelichting_kort + toelichting_lang across all 4 age buckets + missing path. Function NAME score_koopwaarde_trend allowed; narrative TEXT uses 'koopsom-vermelding' / 'actualiteits-proxy' / 'waarde-ontwikkeling' alternatives.
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-02: DEFAULT_WEIGHTS['risico_weights'] dict updated in lockstep with FACTOR_REGISTRY (sum=100 invariant holds at both layers). Single-source-of-truth refactor deferred — would touch rescore-job + presets, out of plan scope.
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-03: D3 GUARD on default_weight equality prevents x1.25 over-inflation when _apply_missing_data_strategy already zeroed BRK weights (>20% missing). D3 only fires when missing-strategy did NOT touch the BRK factor.
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-03: rescore_parcel JOIN ParcelCache.parcel_id (IMKAD str) -> ScanResult (UUID FK) — matches M047/S05 _process_parcel JOIN pattern. enqueue_rescore_parcel uses deterministic _job_id='rescore:{org}:{parcel}' for F7 ARQ-native dedup.
- [Phase 03-scoring-factoren-cascade]: M050/S03 Plan 03-03: NEW app/core/arq.py::get_arq_pool FastAPI dependency centralises app.state.arq_pool access. brk_router D7 hook wraps enqueue_rescore_parcel in try/except (best-effort — NEVER raises out of 200 path). All 6 S02 exception mappings preserved verbatim.
- [Phase 08-brk-fase-2-wire-up]: 08-04: FACTOR_LABELS scope = 12 score-card risico keys (9 pre-M050 + 3 BRK). 4 env keys render via deriveEnvCards inline strings — drift contract documents both paths
- [Phase 08-brk-fase-2-wire-up]: 08-04: Backend FACTOR_REGISTRY frozenset == frontend KNOWN_25_FACTOR_KEYS array kept in sync via paired source-of-truth comments; backend test is the canary (fails first on rename)
- [Phase 08-brk-fase-2-wire-up]: 08-04: Added vitest 'unit' project (node env) alongside existing Storybook project — pure-logic tests only; Storybook remains React rendering test surface per project convention
- [Phase 08-brk-fase-2-wire-up]: 08-04: formatFactorValue BRK cases defensive — accept both backend dict shapes (n_with_hypotheek/n_owners/koopjaar+koopsom) AND legacy primitive shapes (bool/string/int) for non-breaking future evolution
- [Phase 08-brk-fase-2-wire-up]: 08-01: read_for_parcel signature pinned kwarg-only via test_signature_drift_guard — prevents accidental positional misuse swapping organization_id with parcel_id (both stringable UUIDs)
- [Phase 08-brk-fase-2-wire-up]: 08-01: multi-owner same-MAX(fetched_at) branch exercised via mocked AsyncSession — DB UNIQUE constraint uq_brk_org_parcel_fetched blocks ORM same-timestamp inserts; mock-DB pattern proves defensive correctness without DB pollution
- [Phase 08-brk-fase-2-wire-up]: 08-01: test_query_includes_org_filter slices WHERE-clause text specifically — SELECT clause references all columns including organization_id; substring match on full SQL would false-positive even with filter removed
- [Phase 08-brk-fase-2-wire-up]: 08-01: cross-org GET returns 200+[] (NIET 403, NIET 404) — silent isolation per ENG-PLAN AD2; 403/404 would leak existence; empty list indistinguishable from no-data parcel
- [Phase 08-brk-fase-2-wire-up]: Plan 08-06: Split 1922-LOC FavoriteParcelWorkspaceView into 9 cockpit files (all ≤300 LOC) — plan-spec target was 6 files but shell-overflow needed 3 extra extractions (ParcelWorkspaceHeader/WorkspaceContactModal/DossierSection/ActivityTimelineCard)
- [Phase 08-brk-fase-2-wire-up]: Plan 08-06: Parity test adapted to project node-env unit project — pure-logic structural assertions + composition snapshot (regex-assert OnderzoekPhaseView.tsx imports via fs.readFile) instead of @testing-library/react; matches RisicoLayer.factor-coverage.test.tsx precedent
- [Phase 08-brk-fase-2-wire-up]: Plan 08-06: AANPAK CTA copy preserved VERBATIM in cockpit-derivations.ts including BRK CTAs — iron-rule canary in parity test pins pre-08-07 baseline; Plan 08-07 explicitly fails this canary when it lands 'Stap door naar Contact' copy
- [Phase 08-brk-fase-2-wire-up]: Plan 08-07: BRK persist-CTA removed from fase-1 AANPAK card; replaced with unconditional Contact-handoff Link (AD1 fase-overgang IS the gate); NextStep discriminated union introduced in cockpit-derivations.ts
- [Phase 08-brk-fase-2-wire-up]: Plan 08-07: Iron-rule canary in OnderzoekPhaseView.parity.test.tsx UPDATED (not deleted) — re-pins new Contact-handoff copy + route target so future plans cannot silently regress to BRK-on-fase-1
- [Phase 08-brk-fase-2-wire-up]: 08-02: apiFetch + useAuth used instead of eng-plan literal axios/apiClient (project convention — axios is not a dep). Translation mechanical: apiClient.get(url) → apiFetch<T>(url, {method:'GET', accessToken}); AxiosError → ApiError|Error
- [Phase 08-brk-fase-2-wire-up]: 08-02: Pure query/mutation functions (fetchBrkRecords/persistBrkRecords/fetchScanFlags/shouldStopOnSuccess) exported alongside hooks — enables 42 tests in node-env unit project without @testing-library/react (matches Plan 08-04 RisicoLayer test precedent)
- [Phase 08-brk-fase-2-wire-up]: 08-02: useRescorePoll uses runKey-scoped terminal state + phase-derived-from-props — avoids React 19 react-hooks/set-state-in-effect cascade-render lint failure; single justified eslint-disable for intentional tick-reset (matches PipelineStagePill / JuridischKlimaatModalContent precedent)
- [Phase 08-brk-fase-2-wire-up]: 08-02: mapBrkError 503 disambiguation case-insensitive on 'credential' substring; 403 + 404 collapse to identical 'Perceel niet in jouw portfolio' copy (AD2 silent-isolation iron-rule pinned by canary test mapBrkError(403).title === mapBrkError(404).title)
- [Phase 08-brk-fase-2-wire-up]: 08-02: Polling endpoint GET /api/parcels/{parcelId}/scan is forward-looking; backend route doesn't yet exist (Plan 08-03 wires it or adapts /api/scans/parcels/{id}/scan-data). Hook decoupled via shouldStopOnSuccess predicate — endpoint-shape change is one line
- [Phase 08-brk-fase-2-wire-up]: 08-03: Tests use pure-derivation + structural source-text assertion pattern (node-env unit project, no jsdom/RTL) — matches Plan 08-02 deviation #2 + Plan 08-06 parity precedent. Pure helpers derivePersistPanelState / deriveBannerView / deriveContactDispatch exported alongside components.
- [Phase 08-brk-fase-2-wire-up]: 08-03: BrkPersistPanel 5-state discriminated union (kind: idle/loading/error/empty/success). Branch order pending → error → records-present-success → success-empty → idle is load-bearing: records.length>0 wins over isSuccess flag so SUCCESS chip survives subsequent renders.
- [Phase 08-brk-fase-2-wire-up]: 08-03: BrkOwnerCard uses explicit eigenaar_type === 'rechtspersoon' AND eigenaar_type === 'overheid' literal branches (not generic isRechtspersoon boolean) — satisfies plan grep AC and acts as drift canary if backend Pydantic Literal narrows further.
- [Phase 08-brk-fase-2-wire-up]: 08-03: RescoreProgressBanner + ContactPhaseView Links pass search={{ stage: undefined }} to /opgeslagen/perceel/ — matches Phase 6 STATE pattern for parent /opgeslagen route validateSearch. Pre-existing .tsx errors unfixed (scope-boundary).
- [Phase 08-brk-fase-2-wire-up]: 08-03: Polling endpoint URL alias deferred to Plan 08-05/08-08 — logged as DEF-01 in deferred-items.md. useRescorePoll calls /api/parcels/{id}/scan (404 today); real endpoint /api/scans/parcels/{id}/scan-data. Plan 08-03 is component-layer-only; rewire belongs in router-dispatch or E2E plan.
- [Phase 08-brk-fase-2-wire-up]: 08-05: 2-contact lifecycle phase enabled (Phase 8 go-live); plannedMilestone='M050/S06 cont. (Phase 8)'; phases 3-bod through 8-exit MUST remain disabled until M060-M110 ship (sidebar greyed-out icon contract from Phase 6)
- [Phase 08-brk-fase-2-wire-up]: 08-05: REGRESSION-CRITICAL phases.test.ts iron-rule shipped (6/6 green) — guards against premature M060-M110 phase-enable toggles; per-assertion error message names regressing phase; future plans MUST update test (not delete) when shipping new phase
- [Phase 08-brk-fase-2-wire-up]: 08-05 / DEF-01 resolved: required backend ScanResultItem.cascade_rescored_at field (NOT single-line frontend fix as DEF-01 hypothesized — ScanResultItem had no top-level flags dict). Propagated from ScanResult.flags JSONB in get_parcel_scan_data; shouldStopOnSuccess predicate now dual-shape (top-level primary + legacy flags.cascade_rescored_at fallback)
- [Phase 08-brk-fase-2-wire-up]: 08-08: Frontend E2E composition-snapshot pattern (fs.readFile+regex) chosen over RTL/jsdom — node-env unit project convention; 14 tests cover flows 3/4/5/7 + sidebar scope mirror
- [Phase 08-brk-fase-2-wire-up]: 08-08: Phase 105 URL is /api/scans/parcels/{id}/eigendom (parcels_router mounted under scans prefix) — different URL prefix from /api/parcels/{id}/brk strengthens route-shadow contract beyond plan's same-prefix assumption
- [Phase 08-brk-fase-2-wire-up]: 08-08: Backend-Python static regression for frontend sidebar scope rule — Path.read_text + regex on _authenticated.tsx gives single CI gate, no node dependency; per-assertion error messages name regressing pattern

### Pending Todos

- `.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md` — RCE API 403, unblocked by fallback

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-05-19T12:42:01.894Z
Stopped at: Completed Phase 08 Plan 08-08 — 31 NEW tests (6 backend E2E + 7 Phase 105 regression + 4 sidebar scope + 14 frontend composition) green; Phase 8 BRK Fase-2 Wire-up FINAL plan complete; 3 commits
Resume file: None
