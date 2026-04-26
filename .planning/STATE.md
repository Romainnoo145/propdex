---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
status: executing
stopped_at: "Completed 07-05-PLAN.md (Phase 7 complete — story battery green + visual sign-off + post-approval tweaks)"
last_updated: "2026-04-26T16:00:00.000Z"
last_activity: 2026-04-26 — Phase 07 Plan 05 complete — story battery + visual sign-off + CARDS_PER_PAGE 6→4 + badge alignment fix
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 16
  completed_plans: 16
  percent: 88
---

# Propdex — GSD State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** From grondpositie to first spade in one cockpit — no switching between 10 tabs
**Current focus:** M048 Score v4.0 Frontend Scaling — Phases 1+2+5 done; next: plan Phase 3 (woonvisie popup), 4 (KlimaatLayer bug), or 6 (WijkPolicy schema) — parallel-eligible

## Current Position

Phase: 3 of 8 complete (P3/P4/P7/P8 pending; P6 Wave 0+2+3 shipped — Wave 4 integration next)
Plan: 07-05 complete (Phase 7 story battery + visual sign-off — pinning UX confirmed; CARDS_PER_PAGE 6→4)
Status: Phase 7 complete. Ready for Phase 8 (Integration tests + Venlo E2E smoke).
Last activity: 2026-04-26 — Phase 07 Plan 05 complete — story battery + visual sign-off + CARDS_PER_PAGE 6→4 + badge alignment fix

Progress: [█████████░] 88% (7/8 plans)

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

## Accumulated Context

### Roadmap Evolution

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

### Pending Todos

- `.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md` — RCE API 403, unblocked by fallback

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-26T16:00:00.000Z
Stopped at: Completed 07-05-PLAN.md (Phase 7 complete — story battery + visual sign-off + CARDS_PER_PAGE 6→4 + badge alignment fix)
Resume file: None
