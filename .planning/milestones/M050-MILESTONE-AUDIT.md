---
milestone: M050 — BRK Lookup-Wedge (rescoped)
audited: 2026-05-21
status: gaps_found
resolution: "gap closed same-day 2026-05-21 — fix(03) 52add70a stamps cascade_rescored_at in rescore_parcel. SCOR-02 + UX-07 now satisfied. Regression test test_rescore_parcel_stamps_cascade_rescored_at_for_frontend_poll pins the contract (RED→GREEN). Full M050/BRK/phase105 surface 188 passed. Milestone now effectively 22/22 — ready for /gsd:complete-milestone."
supersedes_scope_of: vM050-MILESTONE-AUDIT.md (2026-05-19 pre-split audit — brief-send half split to M051)
scores:
  requirements: 20/22
  phases: 5/5 (each individually verified)
  integration: 4/5 seams wired
  flows: lookup→persist→score ✓ · completion-handshake ✗
nyquist:
  compliant_phases: 0
  partial_phases: 0
  missing_phases: 5
  overall: missing (validation not run; out of scope this audit)
gaps:
  requirements:
    - id: "SCOR-02"
      status: "unsatisfied"
      phase: "Phase 3 (frontend half deferred → Phase 8 polling banner)"
      claimed_by_plans: ["03-03-PLAN", "08-PLAN"]
      completed_by_plans: ["03-03-SUMMARY (backend only)"]
      verification_status: "human_needed (P3) — integration check found the frontend seam broken"
      evidence: "rescore_parcel writes flags['m050_s03_factors_at'] (rescore_cascade_job.py:353); poller shouldStopOnSuccess reads only cascade_rescored_at (useRescorePoll.ts:33); scan endpoint maps only cascade_rescored_at (parcels_service.py:375). After a BRK persist the banner always hits the 30-tick/60s timeout — success state unreachable. 'frontend refetch ≤60s' functionally unmet."
    - id: "UX-07"
      status: "partial"
      phase: "Phase 8"
      claimed_by_plans: ["08-PLAN"]
      completed_by_plans: ["08-SUMMARY"]
      verification_status: "passed (component renders) — but happy-path success branch unreachable"
      evidence: "Same root cause as SCOR-02. RescoreProgressBanner renders correctly and the timeout branch works, but the '✓ Bijgewerkt' + 'Bekijk fase 1' success branch never fires because the completion flag name mismatches."
  integration:
    - seam: "Backend rescore → frontend completion handshake"
      from: "rescore_cascade_job.rescore_parcel"
      to: "useRescorePoll / parcels_service scan-data endpoint"
      issue: "field-name mismatch — job writes flags['m050_s03_factors_at'], consumers read 'cascade_rescored_at' (set only by the woonvisie rescore_parcels_for_document job)"
      fix: "one line — have rescore_parcel also set flags['cascade_rescored_at'], OR teach poller + endpoint to accept m050_s03_factors_at"
  flows:
    - flow: "lookup → persist → score → display-of-completion"
      breaks_at: "display-of-completion (steps 1-3 complete; freshness handshake back to fase-1 fails silently with timeout copy)"
tech_debt:
  - phase: 01-brk-datamodel-retention
    items:
      - "Pre-existing ruff B904 in app/favorites/favorites_service.py:117 (predates phase, scope-boundary)"
      - "25 pre-existing mypy [type-arg] errors across app/models/* (new code is stricter; no net-new)"
      - "gsd-tools state advance-plan chokes on STATE.md prose 'Current Position' format (tooling, non-blocking)"
      - "2 human-verification items deferred to staging once flags flip: real unfavorite soft-delete + Sentry anomaly transport"
  - phase: 02-brk-fetch-persist-endpoint
    items:
      - "respx test substitute + D5 loser-visibility relaxation (accepted, semantics-preserving)"
  - phase: 03-scoring-factoren-cascade
    items:
      - "M050_S03_FACTORS_ENABLED ships default False (production gated on Kadaster DPA)"
  - phase: 06-opgeslagen-cockpit-lifecycle-sidebar
    items:
      - "opgeslagen.tsx 318 LOC (limit relaxed); GemeenteGroupAccordion extraction deferred"
      - "SavedParcelCard.tsx 'as never' cast — stale comment, route registered, no type regression"
  - phase: 08-brk-fase-2-wire-up
    items: []
dormancy_note: "Whole BRK production path ships dormant — M050_BRK_PERSIST_ENABLED + M050_S03_FACTORS_ENABLED both default False, gated on Kadaster verwerkersovereenkomst. The SCOR-02/UX-07 gap is therefore not user-visible today, but WILL bite the moment the flags flip."
---

# M050 — BRK Lookup-Wedge — Rescoped Milestone Audit (2026-05-21)

This is the **re-audit after the 2026-05-19 M050/M051 split**. The original audit
(`vM050-MILESTONE-AUDIT.md`) found 22/45 requirements satisfied because the brief-send
half was never built; that half was split off to **M051**. This audit covers only the
5 BRK-lookup phases that actually shipped (1, 2, 3, 6, 8).

## Result: `gaps_found` — 20/22 requirements satisfied

The split-half closure was expected to pass clean. It nearly does — all 5 phases passed
their own verification and 20/22 requirements are fully satisfied. But the cross-phase
integration check surfaced **one real seam break** that the individual phase verifications
missed (because each phase verified its own half of the handshake in isolation).

### The gap (single root cause, two requirements)

**Field-name mismatch in the rescore-completion handshake.**

| Producer | Consumer(s) |
|----------|-------------|
| `rescore_cascade_job.py:353` writes `flags['m050_s03_factors_at']` | `useRescorePoll.ts:33` reads `cascade_rescored_at` |
| | `parcels_service.py:375` maps only `cascade_rescored_at` |

`cascade_rescored_at` is set exclusively by the *woonvisie* job
(`rescore_parcels_for_document`), not by the BRK `rescore_parcel` job. So after a BRK
persist, the `RescoreProgressBanner` polls for a flag that never appears, runs out its
30 ticks (~60s), and shows the **timeout copy instead of the "✓ Bijgewerkt → Bekijk fase 1"
success state**.

- **SCOR-02** ("BRK-write triggers rescore; frontend refetch shows new scores ≤60s") —
  backend wired, frontend handshake broken → **unsatisfied**.
- **UX-07** (polling-banner success state) — renders, timeout branch works, but the
  happy-path success branch is unreachable → **partial**.

**Fix is one line:** have `rescore_parcel` also stamp `flags['cascade_rescored_at']`
(or teach the poller + scan endpoint to accept `m050_s03_factors_at`). Then re-verify
SCOR-02 + UX-07.

### What is solid (integration check, 4/5 seams WIRED)

1. **Persist → Read** — `POST /brk/persist` writes `BrkOwnershipRecord` (org_id + fetched_at);
   `GET /brk` reads back with identical org + soft-delete filters + `MAX(fetched_at)` anchor.
   No schema mismatch.
2. **BRK-write → scoring cascade** — persist commit → `enqueue_rescore_parcel` → ARQ
   `rescore_parcel` → `enrich_parcel_data_with_brk` → `compute_score_v3` (3 BRK factors
   wired). FACTOR_REGISTRY invariant holds: potentie 9 factors sum=100, risico 16 sum=100.
4. **Multi-tenant isolation** — org_id filtered at every layer (persist, read, cache,
   scoring enrich); cross-org read → `[]`, cross-org POST → 403. Advisory lock keyed on
   (org, parcel). `find_orphaned_records` resolves org via `User.organization_id`
   (ParcelFavorite has no org column — matches the documented retention rule).
5. **Feature-flag coherence** — `M050_BRK_PERSIST_ENABLED` gates only the write path;
   `M050_S03_FACTORS_ENABLED` gates enrichment. Both default False → ships dormant,
   wired-but-off, pending Kadaster DPA.

### Requirements coverage

| Group | IDs | Status |
|-------|-----|--------|
| Datamodel + retention | BRK-01, BRK-02, BRK-03 | ✓ satisfied |
| Fetch + persist + failure registry | BRK-04, BRK-05 | ✓ satisfied |
| Scoring factors + cascade | SCOR-01, **SCOR-02**, SCOR-03 | SCOR-02 ✗ unsatisfied |
| Cockpit + sidebar | UX-01..UX-05 | ✓ satisfied |
| Fase-2 wire-up | UX-06, **UX-07**, UX-08, WIRE-04, WIRE-05 | UX-07 ◐ partial |
| Test coverage | TEST-01, TEST-02, TEST-03, TEST-09 | ✓ satisfied |

No orphaned requirements — every ID in the traceability table appears in a phase
VERIFICATION.md.

## Recommendation

The milestone is one one-line fix away from a clean close. Two routes:

- **Fix-then-close (recommended):** small gap-closure (TDD: failing poll test → stamp the
  flag → green), re-verify SCOR-02 + UX-07, then `/gsd:complete-milestone M050`. The bug
  is dormant today but guaranteed to bite when the Kadaster DPA flips the flags on.
- **Close-with-tracked-debt:** accept the gap as documented tech debt (justified by
  dormancy) and carry the one-liner into M051 (which owns the brief-send flow that will
  also exercise this same rescore handshake). `/gsd:complete-milestone M050` now.

---

_Audited: 2026-05-21 · gsd-integration-checker + 5 phase VERIFICATION.md (3-source cross-reference)_
