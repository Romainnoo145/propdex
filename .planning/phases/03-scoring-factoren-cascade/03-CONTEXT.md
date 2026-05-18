# Phase 03: Scoring-Factoren Cascade — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** PRD Express Path — `.planning/milestones/M050-S03-ENG-PLAN.md` (LOCKED 2026-05-18 via `/plan-eng-review M050/S03`)

<domain>
## Phase Boundary

Add **3 new risico-factoren** to Score v3 driven by S01 persisted BRK data:

1. `hypotheek_risico` (weight=10) — `any(r.heeft_hypotheek for r in records)` binary
2. `eigendoms_complexiteit` (weight=6) — count distinct `(eigenaar_naam, kvk_nummer)`, bucketed 1→0.0 / 2→0.5 / ≥3→1.0
3. `koopwaarde_trend` (weight=4) — `koopjaar`-age proxy with 4 age-buckets (`<5y`/`5–15y`/`15–25y`/`>25y`) — **NOT** a real trend, narrative MUST not contain word "trend"

Existing 13 risico-factoren re-normalize from sum=100 to sum=80 via largest-remainder method. Total FACTOR_REGISTRY risico-sum stays 100.

**S03 unblocks the "intelligence layer"** on S02's persistent BRK rows: the persist button now changes the score, not just shows ownership data. Factors degrade gracefully to `missing=True` for parcels without persisted BRK records — no penalty via P5 runtime redistribution (NOT in `_CRITICAL_RISK_FACTORS`).

**S02 dependency:** SHIPPED 2026-05-18 (`brk_fetch_service` + `POST /api/parcels/{id}/brk/persist` endpoint). S03 wires the persist-endpoint hook to enqueue rescore.

**Boundaries (NOT in scope):**
- Frontend cockpit cards for 3 new factors — M050/S06 territory
- Bulk backfill BRK for all favorites — M052 ops decision
- 4th BRK factor (`zakelijk_recht_complexity`) — M051+
- Postcode-aggregaat real trend / WOZ-delta proxy — deferred (D2 user-locked = koopjaar-age proxy is sufficient for v1)
- Per-project-type weight overrides for 3 new factors — M051 calibration
- AI-narrative — deterministic Dutch f-string templates only

</domain>

<decisions>
## Implementation Decisions (LOCKED via /plan-eng-review)

### Architecture (D1–D10 from `.planning/milestones/M050-S03-ENG-PLAN.md`)

**D1 — BRK → parcel_data materialization (LOCKED)**
- NEW `app/services/scoring_pipeline.py::enrich_parcel_data_with_brk(parcel_data, org_id, db)`
- Queries `BrkOwnershipRecord` filtered by `(organization_id, parcel_id)` + `soft_deleted_at IS NULL`, sorted `fetched_at DESC`
- Result: `parcel_data["brk_records"]: list[BRKRecordDict]` (may be `[]`)
- Called from scan-job + rescore-job before `compute_score_v3`
- Factor functions stay PURE — no DB calls inside `score_v3_factors.py`

**D2 — Weight allocation (LOCKED)**
- New: `hypotheek_risico=10`, `eigendoms_complexiteit=6`, `koopwaarde_trend=4` (sum=20)
- Re-normalize existing 13 risico-factoren proportionally from sum=100 to sum=80
- Integer largest-remainder method (deterministic) via NEW `_rebalance_risico_weights()` helper in `score_v3.py`
- Module-level `assert _REGISTRY_RISICO_SUM == 100` guards correctness
- All 16 final weights pinned in regression test `test_risico_weights_post_s03_match_locked_table`

**Weight rebalance table (locked target):**

| # | Factor key | Pre (gewicht) | Post (gewicht) |
|---|---|---:|---:|
| 1 | funderingsrisico | 12 | 10 |
| 2 | bodemverontreiniging | 11 | 9 |
| 3 | asbest | 10 | 8 |
| 4 | overstromingsrisico | 9 | 7 |
| 5 | geluid_lden | 8 | 6 |
| 6 | luchtkwaliteit_no2_pm10 | 8 | 6 |
| 7 | natura2000_proximity | 7 | 6 |
| 8 | juridisch_klimaat | 8 | 6 |
| 9 | vergunnings_succeskans | 7 | 6 |
| 10 | bestemmingsplan_strict | 7 | 6 |
| 11 | woz_outlier | 5 | 4 |
| 12 | shape_ratio | 4 | 3 |
| 13 | rijksmonument | 4 | 3 |
| 14 | **hypotheek_risico** *(NEW)* | — | 10 |
| 15 | **eigendoms_complexiteit** *(NEW)* | — | 6 |
| 16 | **koopwaarde_trend** *(NEW)* | — | 4 |
| | **SUM** | **100** | **100** |

**D3 — Sparse-data behavior (LOCKED)**
- Runtime redistribution per MEMORY.md P5 weights-principes (locked 2026-04-20)
- When `brk_records == []` OR factor-specific inputs are `None`: `FactorResult(missing=True, genormaliseerde_score=0.0, bijdrage=0.0)`
- NEW module-level set `_SPARSE_REDISTRIBUTABLE_RISICO = {"hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"}` in `score_v3.py`
- `compute_score_v3` excludes these from category-sum when `missing=True` and rescales remaining 13 active risico-factors
- NOT added to `_CRITICAL_RISK_FACTORS` (no -10% penalty when missing)

**D4 — `hypotheek_risico` definition (LOCKED)**
- `score = 1.0 if any(r["heeft_hypotheek"] for r in brk_records) else 0.0`
- Multi-owner parcels: one mortgaged owner is enough to flag risico
- Narrative: `f"{n_with}/{n_total} eigenaren met hypotheek"`
- Empty records → `missing=True`

**D5 — `eigendoms_complexiteit` definition (USER-LOCKED — multi-owner only)**
- Group records by `(eigenaar_naam, kvk_nummer)` tuple → `n_owners = len(group_keys)`
- Score: `1 → 0.0`, `2 → 0.5`, `≥3 → 1.0`
- IGNORES `aandeel` + `zakelijk_recht_type` (user explicit decision)
- Narrative: `f"{n_owners} verschillende eigenaren"`
- Empty records → `missing=True`

**D6 — `koopwaarde_trend` definition (USER-LOCKED — koopjaar-age proxy + narrative honesty)**
- Take most-recent record (by `fetched_at DESC`) with `koopjaar IS NOT NULL`
- `age = current_year - koopjaar`
- Bucketing: `age<5 → 0.3` / `5–15 → 0.5` / `15–25 → 0.7` / `>25 → 0.9`
- `koopjaar IS NULL` OR no records → `missing=True`
- Future-koopjaar (data error) → `missing=True` (defensive, F5)
- Narrative MUST honestly state: `f"Koop in {koopjaar} ({age}j geleden) — koopsom mogelijk verouderd"`
- **REGRESSION-CRITICAL**: narrative MUST NOT contain substring "trend" (pinned in test)

**D7 — Re-score trigger after persist (LOCKED)**
- S02 `POST /api/parcels/{parcel_id}/brk/persist` enqueues `rescore_cascade_job.rescore_parcel(org_id, parcel_id)` AFTER Txn2 commit (S02 D4)
- Reuse existing M047/S05 job — NO new job module
- Job idempotent on `(org_id, parcel_id)` via existing ARQ job-key dedup `rescore:{org}:{parcel}`
- Frontend React Query refetch on `score-detail` until `flags["m050_s03_factors_at"]` timestamp > persist-time (frontend = M050/S06 territory)
- REJECT sync re-score: adds 200–500ms to persist + couples HTTP path to scoring engine

**D8 — Feature-flag gating (LOCKED)**
- NEW env-flag `M050_S03_FACTORS_ENABLED` (default `False` until M050/S07 wiring)
- When `False`: `enrich_parcel_data_with_brk` returns parcel_data unchanged AND the 3 factor functions return `FactorResult(missing=True, ...)` REGARDLESS of `brk_records` content
- Allows S03 code to land before M050/S06 cockpit + before M050.5/S01 tier-gate is ready
- Matches M050-ENG-PLAN D4 env-flag triad pattern

**D9 — Score-time BRK fetch policy (LOCKED)**
- `enrich_parcel_data_with_brk` reads `BrkOwnershipRecord` table **ONLY**
- NEVER calls `brk_fetch_service.fetch_and_persist` (S02)
- Scoring NEVER spends a Kadaster credit — quota-budget protected by separation-of-concerns
- Fresh BRK only enters via S02's explicit persist endpoint

**D10 — Backfill strategy (LOCKED)**
- NO automatic backfill
- Existing `scan_results` with `flags["m050_s03_factors_at"]` absent get `missing=True` for the 3 factors via D3 runtime redistribution
- Score values shift slightly for parcels with non-sparse 13-factor data (rescaled — Carry-3 release-note item)
- Persisting BRK for one parcel triggers rescore for that parcel only
- Bulk backfill = M052 ops decision

### REGRESSION-CRITICAL tests (Iron Rule, MEMORY.md `feedback_iron_rule_regression_pattern`)

Following S01/S02 precedent under `backend/tests/regression/`:

1. **`test_m050_s03_multitenant.py::test_enrich_filters_by_org_id`** — pin SQL `WHERE organization_id = $1` clause in `enrich_parcel_data_with_brk` query. Insert 2 records under different orgs for same parcel_id. Query via enrich → returns only matching org's records. **Drift = silent cross-tenant data leak (AVG breach).**
2. **`test_m050_s03_factor_weights.py::test_risico_weights_post_s03`** — pin all 16 weights to D2 table. Module-import time assertion already guards sum=100; this test guards individual weights to detect drift in either direction.
3. **`test_m050_s03_factor_signatures.py::test_three_factors_in_registry`** — pin `FACTOR_REGISTRY["hypotheek_risico"]`, `["eigendoms_complexiteit"]`, `["koopwaarde_trend"]` exist with `category="risico"` + `bron="brk"`.
4. **`test_m050_s03_narrative_honesty.py::test_koopwaarde_trend_narrative_no_trend_word`** — assert `score_koopwaarde_trend(...).toelichting_kort` and `toelichting_lang` do NOT contain the substring "trend" (case-insensitive). Enforces D6 narrative-honesty premise correction.

### Service-layer file budget

```
app/services/
├── scoring_pipeline.py            # NEW S03 — enrich_parcel_data_with_brk + _missing_brk helper
├── score_v3.py                    # MODIFIED — +3 registry entries, _SPARSE_REDISTRIBUTABLE_RISICO, _rebalance_risico_weights, compute_score_v3 D3
└── score_v3_factors.py            # MODIFIED — +3 factor functions
app/jobs/
└── rescore_cascade_job.py         # REUSE (M047/S05); call site = brk_router persist endpoint
app/api/endpoints/
└── brk_router.py                  # MODIFIED — D7 hook: enqueue rescore AFTER Txn2 commit
app/core/config.py                 # MODIFIED — add M050_S03_FACTORS_ENABLED flag
backend/tests/
├── regression/                    # NEW 4 files (D3 D2 signatures narrative)
├── unit/services/                 # NEW factor tests
└── integration/                   # NEW persist→rescore E2E
```

### Claude's Discretion (implementation details NOT locked)

- Exact test file names (use S01/S02 naming convention)
- Exact narrative wording for `hypotheek_risico` + `eigendoms_complexiteit` (D-decisions specify shape, polish is implementation)
- BRKRecordDict TypedDict definition location (suggested: `app/services/scoring_pipeline.py` co-located with consumer)
- Internal helper function ordering / private-name conventions
- Logging instrumentation placement (follow existing M046/M047 patterns)
- `_rebalance_risico_weights` largest-remainder tie-breaker rule (recommended: alphabetical by factor key for determinism)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture spec (LOCKED — primary source of truth)
- `.planning/milestones/M050-S03-ENG-PLAN.md` — D1–D10, factor specs with Python pseudocode, weight-rebalance table, failure-modes registry F1–F10, test coverage diagram, NOT-in-scope, reuse table
- `.planning/milestones/M050-ENG-PLAN.md` — Milestone D1–D6, ASCII data-flow critical path S02 → S03 → S07
- `.planning/milestones/M050-INDEX.md` — Slice catalogue
- `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` — Q6/Q7/Q8 locked (AVG retention, quota defaults)

### Upstream slices (LOCKED — DO NOT modify)
- `.planning/milestones/M050-S01-ENG-PLAN.md` — `BrkOwnershipRecord` model, retention policy
- `.planning/milestones/M050-S02-ENG-PLAN.md` — D1–D15, `brk_fetch_service`, persist endpoint
- `.planning/phases/01-brk-datamodel-retention/` — S01 plans + summaries
- `.planning/phases/02-brk-fetch-persist-endpoint/` — S02 plans + summaries (template pattern)

### Existing code (reuse, do NOT rebuild)
- `backend/app/services/score_v3.py:74-308` — `FactorRegistryEntry` dataclass + `FACTOR_REGISTRY` + module-level sum-guards + `_CRITICAL_RISK_FACTORS`
- `backend/app/services/score_v3.py:20-40` — `FactorResult` dataclass with `missing` + `percentage_of_category`
- `backend/app/services/score_v3_factors.py` — Existing 21 factor functions (template for new 3)
- `backend/app/models/brk_ownership_record.py` — S01 `BrkOwnershipRecord` SQLAlchemy model + TenantMixin
- `backend/app/schemas/brk_ownership_record.py` — `BRKOwnershipRecordRead` Pydantic schema
- `backend/app/jobs/rescore_cascade_job.py` — M047/S05 rescore-parcel pattern (D7 reuse target)
- `backend/app/api/endpoints/brk_router.py` — S02 persist endpoint (D7 hook site)
- `backend/app/core/config.py` — feature-flag pattern (`M050_BRK_PERSIST_ENABLED` mirror)

### Project conventions
- `CLAUDE.md` (repo root) — drie-laags pattern, multi-tenant security, validation commands
- `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md` — Key patterns (transactions, datetimes, SET LOCAL asyncpg, `feedback_iron_rule_regression_pattern`)

</canonical_refs>

<specifics>
## Specific Implementation Anchors

### Materialization function signature (D1)

```python
# app/services/scoring_pipeline.py (NEW)
from typing import TypedDict
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.brk_ownership_record import BrkOwnershipRecord


class BRKRecordDict(TypedDict, total=False):
    eigenaar_type: str
    eigenaar_naam: str | None
    kvk_nummer: str | None
    statutaire_zetel: str | None
    zakelijk_recht_type: str | None
    aandeel: str | None
    koopsom: float | None       # Decimal → float at boundary
    koopjaar: int | None
    heeft_hypotheek: bool
    fetched_at: str             # ISO-8601 string, not datetime


async def enrich_parcel_data_with_brk(
    parcel_data: dict,
    org_id: UUID,
    db: AsyncSession,
) -> dict:
    """Materialize latest BRK rows for (org_id, parcel_id) into parcel_data["brk_records"].

    D1: single source of BRK data for scoring. Factor functions stay PURE.
    D8: when M050_S03_FACTORS_ENABLED=False → returns parcel_data unchanged.
    D9: read-only; never triggers HTTP fetch.
    """
```

### compute_score_v3 D3 redistribution shape

```python
# app/services/score_v3.py (MODIFY)

_SPARSE_REDISTRIBUTABLE_RISICO: set[str] = {
    "hypotheek_risico",
    "eigendoms_complexiteit",
    "koopwaarde_trend",
}

def compute_score_v3(parcel_data: dict, project_type: str = "onbepaald") -> ScoreV3Result:
    # ... existing 8 potentie + (now 16) risico factor execution ...

    # D3 — runtime redistribution for sparse BRK factors
    missing_redistributable_keys = {
        k for k in _SPARSE_REDISTRIBUTABLE_RISICO
        if k in risico_breakdown and risico_breakdown[k].missing
    }
    if missing_redistributable_keys:
        # Sum of weights that should NOT contribute to category total
        missing_weight = sum(
            FACTOR_REGISTRY[k].default_weight for k in missing_redistributable_keys
        )
        active_weight = 100 - missing_weight
        # Rescale active risico factors proportionally so they sum to 100
        if active_weight > 0:
            scale = 100.0 / active_weight
            for k, factor in risico_breakdown.items():
                if k not in missing_redistributable_keys and not factor.missing:
                    factor.gewicht = factor.gewicht * scale
                    factor.bijdrage = factor.genormaliseerde_score * factor.gewicht
```

### brk_router D7 hook

```python
# app/api/endpoints/brk_router.py (MODIFY)
from app.jobs.rescore_cascade_job import enqueue_rescore_parcel  # or equivalent

@router.post("/parcels/{parcel_id}/brk/persist")
async def persist_brk(...):
    # ... S02 Txn1 + HTTP + Txn2 (LOCKED, do not modify) ...
    await session.commit()  # Txn2 commit (S02 D4)

    # D7 — enqueue rescore AFTER commit (NEVER inside Txn2)
    await enqueue_rescore_parcel(org_id=current_user.organization_id, parcel_id=parcel_id)

    return result
```

### Failure-modes registry (per M050-S03-ENG-PLAN F1–F10)

| # | Codepath | Failure scenario | Required handling |
|---|---|---|---|
| F1 | enrich_parcel_data_with_brk | DB connection mid-job | Re-raise → ARQ retry (matches S01 cron) |
| F2 | enrich_parcel_data_with_brk | Multi-tenant leak (wrong org_id) | **REGRESSION-CRITICAL test** — query-level guard |
| F3 | score_hypotheek_risico | `heeft_hypotheek` is None (defensive) | Treat as False via falsy short-circuit |
| F4 | score_eigendoms_complexiteit | All records have NULL naam+kvk | `{(None,None)}` → n_owners=1 → score=0 (correct) |
| F5 | score_koopwaarde_trend | Future koopjaar (data error) | `age<0` → `missing=True` (chosen behavior) |
| F6 | _rebalance_risico_weights | Rounding produces sum=99 or 101 | Largest-remainder method MUST hit sum=100 (assert) |
| F7 | rescore_cascade_job | Concurrent persists same (org, parcel) | ARQ job-key dedup `rescore:{org}:{parcel}` |
| F8 | compute_score_v3 redistribution | All 3 BRK + ≥1 existing risico missing | Rescale only over non-missing |
| F9 | Feature flag off | M050_S03_FACTORS_ENABLED=False but records exist | All 3 return missing=True regardless (D8) |

### Performance budgets

- `enrich_parcel_data_with_brk`: <50ms p95 (single indexed query, ≤10 rows)
- 3 new factor functions combined: <5ms p95 (pure Python over small list)
- D3 redistribution: <2ms additional p95
- `rescore_parcel` job total: <2s p95

</specifics>

<deferred>
## Deferred Ideas

| Item | Reason | Target |
|---|---|---|
| Frontend cockpit cards (3 factor displays) | UI = M050/S06 territory; S03 backend-only | M050/S06 |
| Bulk backfill BRK for all favorites | Credit explosion + Q8 quota violations | M052 ops decision |
| 4th BRK factor `zakelijk_recht_complexity` (opstal/erfpacht/vruchtgebruik) | Out of M050-INDEX scope | M051+ |
| Postcode-aggregaat real trend (koopsom/m² over time) | D2 user-locked = koopjaar-age sufficient v1 | M053+ |
| WOZ-delta proxy as alternative koopwaarde signal | Single D2 approach locked | future, if signal-quality complaint |
| Per-project-type weight overrides for 3 new factors | First-version-keep-flat-weights | M051 calibration |
| Re-score on BRK soft-delete (favoriet unfavorited) | Sparse-redistribution catches it on next score-fetch | None — by design |
| AI-narrative for factors | Deterministic templates match existing 21 factors | n/a |

</deferred>

---

*Phase: 03-scoring-factoren-cascade*
*Context gathered: 2026-05-18 via PRD Express Path from M050-S03-ENG-PLAN.md (LOCKED via /plan-eng-review M050/S03)*
