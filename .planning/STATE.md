---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-01-PLAN.md (BUG-01 KlimaatLayer ghost-verdict — key prop fix + 3 Storybook stories green)
last_updated: "2026-04-26T12:36:43.486Z"
last_activity: 2026-04-24 — M048/Phase 6 Plan 03 shipped — rewrote score_woonvisie_match for WijkPolicy; 5 min, 1 task, 1 file
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 11
  completed_plans: 11
  percent: 88
---

# Propdex — GSD State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** From grondpositie to first spade in one cockpit — no switching between 10 tabs
**Current focus:** M048 Score v4.0 Frontend Scaling — Phases 1+2+5 done; next: plan Phase 3 (woonvisie popup), 4 (KlimaatLayer bug), or 6 (WijkPolicy schema) — parallel-eligible

## Current Position

Phase: 3 of 8 complete (P3/P4/P7/P8 pending; P6 Wave 0+2+3 shipped — Wave 4 integration next)
Plan: 06-03 complete (per-wijk differentiating woonvisie scorer — 9/9 Phase-6 unit tests green)
Status: Ready to execute Plan 06-04 (Venlo integration + WoonvisiePopup data-contract smoke)
Last activity: 2026-04-24 — M048/Phase 6 Plan 03 shipped — rewrote score_woonvisie_match for WijkPolicy; 5 min, 1 task, 1 file

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

### Pending Todos

- `.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md` — RCE API 403, unblocked by fallback

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-26T12:30:22.558Z
Stopped at: Completed 04-01-PLAN.md (BUG-01 KlimaatLayer ghost-verdict — key prop fix + 3 Storybook stories green)
Resume file: None
