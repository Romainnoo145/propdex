---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
status: planning
stopped_at: Completed 05-document-level-cache-sentinel-woonvisie/05-01-PLAN.md
last_updated: "2026-04-24T19:06:44.874Z"
last_activity: 2026-04-24 — M048 scope expansion via office hours; 4 new phases added (P5-P8) from design doc 20260424-200512
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 4
  completed_plans: 4
  percent: 37.5
---

# Propdex — GSD State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** From grondpositie to first spade in one cockpit — no switching between 10 tabs
**Current focus:** M048 Score v4.0 Frontend Scaling — Phases 1+2+5 done; next: plan Phase 3 (woonvisie popup), 4 (KlimaatLayer bug), or 6 (WijkPolicy schema) — parallel-eligible

## Current Position

Phase: 3 of 8 complete (P3/P4/P6-P8 pending)
Plan: 05-01 complete (document-level cache sentinel woonvisie — CACHE-02 + TEST-05)
Status: Ready to plan next phase
Last activity: 2026-04-24 — M048/Phase 5 shipped — DOCUMENT_SENTINEL + SCHEMA_VERSION 2→3; 33 min, 6 tasks, 7 files

Progress: [████░░░░░░] 37.5% (3/8 phases)

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

### Pending Todos

- `.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md` — RCE API 403, unblocked by fallback

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-24T19:06:44.872Z
Stopped at: Completed 05-document-level-cache-sentinel-woonvisie/05-01-PLAN.md
Resume file: None
