# Phase 108: Score Customization — Research

**Researched:** 2026-03-14
**Domain:** Score engine extension + per-org weight customization + settings UI sub-route
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Score Formula Overhaul**
- Current model broken: `overall = potentie - risico` pushes most parcels toward 0
- New model: `overall = potentie × (1 - risico_discount)` — risico is a discount on potentie, not a subtraction
- Max discount cap: 50% — even the riskiest parcel keeps half its potentie score
- Default overall balance: 70% potentie / 30% risico
- User-adjustable: potentie/risico balance slider lets orgs shift from opportunity-first to risk-averse

**Factor Scope**
- All 21 factors adjustable: 8 potentie + 13 risico (after adding 4 env factors)
- 4 new risico factors: natura2000, overstromingsrisico, geluid, luchtkwaliteit (from Phase 99 enrichment)
- Toggle on/off: weight = 0 means disabled
- Minimum constraint: at least 3 active factors per category
- Weight scale: 1-10 per factor (system normalizes internally)

**Presets**
- Claude designs presets based on target audience analysis
- Preset = starting point, user can fine-tune
- UI: card-selection with title + description (not dropdown, not pills)

**Settings UI**
- Route: `/instellingen/score` — own sub-route
- Layout top-to-bottom: Preset cards → Overall balance slider → Potentie factor table → Risico factor table → Save button
- Factor table format: compact table rows — Factor | Actief toggle | Gewicht dropdown 1-10
- Save behavior: explicit save + async re-score of all org scan_results + impact preview

**Organization Scope**
- Per-organization weights, not per-user
- All members can edit (no role system)
- No custom weights = defaults (standard preset)
- Storage: new column on organizations table or separate table — weights + active preset name

**Re-scoring**
- Weights-only re-application: don't call compute_score_v3() again
- Use stored genormaliseerde_score per factor × new weights × new formula
- Async background job triggered on save
- Impact preview: "X percelen omhoog, Y omlaag, gemiddelde score Δ"
- Custom profile badge: subtle label near scores in parcel detail panel when org uses non-default weights

### Claude's Discretion
- Exact preset profiles (names, descriptions, weight distributions)
- 4 new environmental factor implementations (normalization, narratieven, gewichten relative to existing 9)
- Rebalancing of existing 9 risico factor weights to accommodate 4 new ones
- Impact preview UI design details
- Tab navigation implementation in /instellingen (sub-route wiring)

### Deferred Ideas (OUT OF SCOPE)
- Per-scan weight override (different weights for different projects)
- Role-based access control for settings
- Score history / audit trail (track weight changes over time)
</user_constraints>

---

## Summary

Phase 108 has three distinct work streams: (1) extend the score engine with 4 environmental risk factors and fix the overall formula, (2) build org-level weight storage with a re-scoring background job, and (3) add a `/instellingen/score` sub-route with preset cards, a balance slider, and factor tables.

The score engine extension is straightforward — data for all 4 new factors already exists in `scan_results.flags` as of Phase 99 (`natura2000`, `overstromingsrisico`, `geluid`, `luchtkwaliteit`). The normalization logic mirrors the existing 9 risico factor patterns. The formula fix from `potentie - risico` to `potentie × (1 - risico_discount)` requires changing both `score_v3.py` and the backfill tool, plus updating `ScoreV3Result.overall` semantics.

Weight customization requires adding a `score_weights` JSONB column on the `organizations` table (migration needed), a new `/api/organizations/score-weights` endpoint, and a background job that re-applies stored weights to existing `genormaliseerde_score` values without re-running full factor computations. The frontend adds a `/instellingen/score` route as a TanStack Router file at `frontend/src/routes/_authenticated/instellingen.score.tsx` or a nested route structure.

**Primary recommendation:** Implement as three sequential plan waves: (1) score engine (4 factors + formula fix + backfill), (2) org weight storage + API + background job, (3) Settings UI sub-route.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.x | installed | `score_weights` JSONB column on organizations | Project ORM pattern |
| Alembic | installed | Migration for `score_weights` column | Project migration tool |
| ARQ 0.27 | installed | Background re-score job | Project job queue — same worker pattern as `area_scan_job` |
| FastAPI | installed | New `/api/organizations/score-weights` endpoint | Project API framework |
| TanStack Router | installed | `/instellingen/score` sub-route | Project routing |
| TanStack Query | installed | `useScoreWeights` + `useSaveScoreWeights` hooks | Project data fetching |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pydantic v2 | installed | `ScoreWeightsConfig` + `SaveScoreWeightsRequest` schemas | Backend validation |
| React Hook Form | installed | Balance slider + factor dropdowns form state | As used in AccountSection.tsx |
| Zod | installed | Frontend schema validation for save request | As used in settings sections |
| Framer Motion | installed | Preset card selection animation | Consistent with existing Aura animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB column on organizations | New `org_score_weights` table | Column simpler for single JSON blob; separate table needed if per-scan weights added later (deferred) |
| ARQ background job | Synchronous re-score | Sync would block API response for large orgs (137k Venlo parcels); ARQ already running |
| Enqueue via `arq_pool.enqueue_job` | Redis direct call | Consistent with area_scan pattern in scans/router.py |

**No new dependencies needed.** All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── models/organization.py          # ADD: score_weights JSONB column
│   ├── services/score_v3.py            # MODIFY: formula + ScoreV3Result + weights param
│   ├── services/score_v3_factors.py    # ADD: 4 new factor functions
│   ├── jobs/rescore_weights.py         # NEW: background re-score job
│   ├── jobs/worker.py                  # ADD: rescore_weights_job registration
│   ├── scans/router.py                 # ADD: custom_badge in parcel response
│   └── users/router.py (or new org router) # ADD: GET/PUT /api/organizations/score-weights
│   alembic/versions/XXX_add_score_weights_to_organizations.py  # NEW

frontend/
├── src/
│   ├── routes/_authenticated/
│   │   └── instellingen.score.tsx      # NEW: /instellingen/score route (TanStack Router flat file)
│   ├── routes/_authenticated/instellingen.tsx  # MODIFY: add tab nav
│   ├── components/settings/
│   │   ├── ScoreSection.tsx            # NEW: main score customization section
│   │   ├── PresetCards.tsx             # NEW: preset card selection
│   │   ├── BalanceSlider.tsx           # NEW: potentie/risico slider
│   │   └── FactorTable.tsx             # NEW: compact factor table (reused for potentie + risico)
│   ├── hooks/
│   │   └── useScoreWeights.ts          # NEW: TanStack Query hooks
│   └── lib/types/
│       └── scoreWeights.ts             # NEW: TypeScript types for score weights
```

### Pattern 1: JSONB column on Organization model

**What:** Add `score_weights: Mapped[dict | None]` to `Organization` — stores weights + active preset name + potentie/risico balance as a single JSON blob.
**When to use:** Single tenant config object, no query filtering needed on contents.

```python
# backend/app/models/organization.py
from sqlalchemy.dialects.postgresql import JSONB

class Organization(Base, TimestampMixin):
    # ... existing columns ...
    score_weights: Mapped[dict | None] = mapped_column(
        type_=JSONB,
        nullable=True,
        comment="Per-org score weight config: {preset, balance, potentie_weights, risico_weights}",
    )
```

Schema shape stored:
```json
{
  "preset": "standaard",
  "potentie_risico_balance": 0.7,
  "potentie_weights": {"vrije_grond": 12, "optoppotentie": 10, ...},
  "risico_weights": {"funderingsrisico": 15, "natura2000": 6, ...}
}
```

When `score_weights` is `None` → use system defaults (backward compat, no migration data needed).

### Pattern 2: New formula in score_v3.py

**What:** Replace `overall = potentie - risico` with discount model. Weighted balance is passed as a parameter.

```python
# score_v3.py changes

@dataclass
class ScoreV3Result:
    potentie_score: float    # 0-100
    risico_score: float      # 0-100
    overall: float           # 0-100 (new formula, no longer can be negative)
    # ... rest unchanged

def compute_score_v3(
    parcel_data: dict[str, Any],
    neighborhood_metrics: dict[str, Any] | None = None,
    custom_weights: dict[str, Any] | None = None,  # NEW param
) -> ScoreV3Result:
    # custom_weights = {potentie_weights: {factor: weight}, risico_weights: {}, balance: 0.7}
    ...
    # Apply custom weights to FactorResult.gewicht before computing bijdrage
    if custom_weights:
        _apply_custom_weights(breakdown, custom_weights)

    # New formula
    balance = (custom_weights or {}).get("potentie_risico_balance", 0.7)
    _RISICO_MAX_DISCOUNT = 0.5  # 50% cap
    risico_discount = min(_RISICO_MAX_DISCOUNT, (risico_score / 100) * (1 - balance))
    overall = round(potentie_score * (1 - risico_discount), 1)
    overall = max(0.0, min(100.0, overall))
```

**CRITICAL:** The `genormaliseerde_score` per factor is computed from raw data and is NOT affected by weight changes. Only `bijdrage = genormaliseerde_score × gewicht` changes. This is what makes re-scoring cheap — just re-multiply stored `genormaliseerde_score` values.

### Pattern 3: Re-score background job (weights-only)

**What:** New ARQ job that reads `scan_results.flags["score_breakdown"]` (stored `genormaliseerde_score` per factor), applies new weights from org's `score_weights`, recomputes `bijdrage`, subscore totals, new formula, and writes back to `flags["scores"]` + `score`.

```python
# app/jobs/rescore_weights.py
async def rescore_weights_job(ctx: dict, *, organization_id: str) -> dict:
    """Re-apply org custom weights to all scan_results without re-fetching APIs.

    For each scan_result:
      1. Read flags["score_breakdown"] (has genormaliseerde_score per factor)
      2. Load org's score_weights from organizations table
      3. For each factor: bijdrage = genormaliseerde_score × new_weight
      4. Re-sum potentie/risico subscores, apply new formula
      5. Write back flags["scores"], sr.score
      6. Track delta for impact summary
    Returns: {processed, up_count, down_count, avg_delta, job_id}
    """
```

Registration in `worker.py`: add `rescore_weights_job` to `WorkerSettings.functions`.

### Pattern 4: TanStack Router sub-route for /instellingen/score

**What:** TanStack Router v1 uses file-based routing. Flat file at `instellingen.score.tsx` creates `/instellingen/score`. The existing `instellingen.tsx` needs a tab nav added to switch between account/score.

```typescript
// routes/_authenticated/instellingen.score.tsx
export const Route = createFileRoute('/_authenticated/instellingen/score')({
  component: InstellingenScorePage,
})
```

The current `instellingen.tsx` route must remain at `/_authenticated/instellingen` (the account route). The score route is a sibling, not a child — no `Outlet` needed in `instellingen.tsx`.

**Tab nav pattern:** Add a tab bar at the top of both pages that links between `/instellingen` and `/instellingen/score`. Use `useMatchRoute` for active state (same pattern as map.tsx).

### Pattern 5: 4 New Environmental Factor Functions

Each follows the exact same template as existing 9 risico factors in `score_v3_factors.py`. Data is already pre-cached in `flags`.

**natura2000** → `score_natura2000(parcel_data)`
- Input: `parcel_data.get("natura2000")` → `{naam, nr, bescherming, binnen_5km: True}` or `None`
- Score: `1.0` if binnen_5km else `0.0`; neutral `0.5` if missing
- Gewicht: 5 (new total risico max = 67 + 5 = 72)
- Risk: Stikstof/AERIUS issues → project can be blocked

**overstromingsrisico** → `score_overstromingsrisico(parcel_data)`
- Input: `parcel_data.get("overstromingsrisico")` → `{description, qualitative_value, in_risk_zone: True}` or `None`
- Score: `1.0` if in_risk_zone else `0.0`; neutral `0.5` if missing
- Gewicht: 6
- Risk: Wonen in overstromingsgebied → verzekeringskosten, gemeentelijk beleid

**geluid** → `score_geluid(parcel_data)`
- Input: `parcel_data.get("geluid")` → `{lden_db, classification, boven_grenswaarde}` or `None`
- Score: map classification → `{acceptabel: 0.0, verhoogd: 0.4, hoog: 0.7, zeer_hoog: 1.0}`; neutral `0.3` if missing (most NL is quiet)
- Gewicht: 5
- Risk: >50 dB Lden → Omgevingswet blokkeert woonbestemming zonder maatwerkregel

**luchtkwaliteit** → `score_luchtkwaliteit(parcel_data)`
- Input: `parcel_data.get("luchtkwaliteit")` → `{no2_ugm3, pm10_ugm3, boven_grenswaarde}` or `None`
- Score: use NO2 as primary; `normalize_linear(no2, 20, 50)` (20 = very clean, 50 = at EU limit)
- Gewicht: 4
- Risk: Boven EU grenswaarden (40 µg/m³) → gevoelige bestemmingen (school, wonen) problematisch

**New risico totals (after adding 4):**
- Old sum: 15+6+7+5+8+7+8+6+5 = 67
- Add: 5+6+5+4 = 20
- New `_RISICO_MAX` = 87
- Old factors sum to 67, so existing factor weights unchanged → just update `_RISICO_MAX` constant

**Rebalancing decision:** Do NOT rebalance existing weights. Adding 4 new factors at smaller weights (5+6+5+4=20) is additive — the normalization denominator `_RISICO_MAX` absorbs them. Existing score distributions are preserved for old scans that lack env data (they'll score 0.3-0.5 neutral on new factors).

### Pattern 6: New API endpoint

Follows `users/router.py` pattern for settings-style GET/PUT on current org context.

```python
# Can add to users/router.py or create new organizations/router.py
@router.get("/me/score-weights", response_model=ScoreWeightsResponse)
async def get_score_weights(
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScoreWeightsResponse:
    ...

@router.put("/me/score-weights", response_model=ScoreWeightsResponse)
async def save_score_weights(
    data: SaveScoreWeightsRequest,
    request: Request,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScoreWeightsResponse:
    # 1. Validate (≥3 active per category)
    # 2. Save to org.score_weights
    # 3. Enqueue rescore_weights_job
    # 4. Return {weights, job_id} for frontend polling
```

**Route prefix:** Add to `users/router.py` as `/api/users/org/score-weights` (reusing existing auth deps + prefix) OR create `organizations/router.py` with prefix `/api/organizations`. Using `users/router.py` is simpler (no new router registration in `main.py`).

### Anti-Patterns to Avoid

- **Re-running compute_score_v3() during re-score**: This re-fetches factor logic from parcel_data. The decision is to ONLY re-multiply stored `genormaliseerde_score × new_weights`. Only read `score_breakdown` from flags.
- **Changing factor `gewicht` in `score_v3_factors.py`**: Individual factor functions hardcode `gewicht`. With custom weights, the `gewicht` field in `FactorResult` must be overridden AFTER construction, in `_apply_custom_weights()`. Don't change the hardcoded defaults — they define the standard preset.
- **TanStack Router nested routes with Outlet**: `/instellingen/score` should be a flat sibling route (`instellingen.score.tsx`), not a nested layout requiring `<Outlet>` in `instellingen.tsx`. The current `instellingen.tsx` does NOT render `<Outlet>`, so adding a nested route would break navigation.
- **Storing custom flag in each scan_result**: The custom profile badge should be derived from org settings at read time (org has custom weights → show badge), NOT stored per scan_result. Avoids mass-update on weight change.
- **`async with db.begin()` pattern**: Existing codebase uses direct `db.add()/db.flush()/db.commit()` — don't use `begin()` context manager (causes "transaction already begun" error per MEMORY.md).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background job execution | Custom async queue | ARQ with existing `arq_pool.enqueue_job()` | Worker already running, job pattern established in area_scan_job |
| Job status polling | Custom websocket / SSE | ARQ Job object + existing `GET /api/scans/{id}/status` pattern | Already implemented for scan jobs |
| Form state management | useState chains | react-hook-form (used in AccountSection, PasswordSection) | Complex form with validation, isDirty tracking, error display |
| Frontend form validation | Manual checks | Zod + zodResolver (same pattern as settings sections) | Type-safe, mirrors Pydantic backend validation |
| Database migration | Manual SQL | Alembic autogenerate | Project uses alembic throughout, superuser migration URL in .env |

---

## Common Pitfalls

### Pitfall 1: _RISICO_MAX constant must match actual gewicht sum
**What goes wrong:** If `_RISICO_MAX` is not updated when 4 new factors are added, all risico scores will be inflated (dividing by too-small denominator).
**Why it happens:** `_RISICO_MAX` is a hardcoded constant in `score_v3.py`. The 4 new factors each hardcode `gewicht` in their functions.
**How to avoid:** After writing the 4 factor functions, sum all risico `gewicht` values and set `_RISICO_MAX` explicitly. Current: 67. New: 67 + 5+6+5+4 = 87. Also update `_POTENTIE_MAX` if any potentie factors change (they don't in this phase).
**Warning signs:** `risico_score` for a parcel with all factors present >100.

### Pitfall 2: Re-score must handle missing `score_breakdown`
**What goes wrong:** Old scan_results (pre-Phase 100) have `flags["score_breakdown"]` as `None` or v2.1 format (lacks `genormaliseerde_score` + `categorie`). Re-score job crashes or produces garbage.
**Why it happens:** Phase 101 backfill ran, but some parcels may still have v2.1 data.
**How to avoid:** In `rescore_weights_job`, check `flags.get("score_model_version") == "score-v3.0"` before processing. Skip non-v3.0 rows; log a count. These parcels will get proper scores on next wijk scan.
**Warning signs:** Job errors or zero parcels processed.

### Pitfall 3: Custom weights vs standard-preset weights diverge silently
**What goes wrong:** Standard preset weights are hardcoded in `score_v3_factors.py`. If a factor's hardcoded weight is changed in code but the standard preset schema in `ScoreWeightsConfig` is not updated to match, the "reset to standard" UI shows wrong values.
**Why it happens:** Two sources of truth for default weights.
**How to avoid:** Define `DEFAULT_WEIGHTS` dict in `score_v3.py` (exported constant) that mirrors the factor function hardcoded values. Use this same dict as the "standard" preset baseline. Factor functions read from this dict (or import it), not duplicate literals.

### Pitfall 4: Formula change breaks tile proxy score range
**What goes wrong:** Tile proxy colors parcels by `scan_results.score` (the `overall` column, 0-100). Old formula could produce negatives (clamped to 0). New formula produces 0-100 naturally. BUT the backfill must update both `flags["scores"]["overall"]` AND `sr.score` (the column) to use the new formula.
**Why it happens:** `sr.score` is denormalized from `flags["scores"]["overall"]` for fast tile queries.
**How to avoid:** In rescore_weights_job, always write `sr.score = new_overall`. In the backfill, update the model version to distinguish from old runs.

### Pitfall 5: TanStack Router route file naming for sub-routes
**What goes wrong:** TanStack Router v1 uses dot-notation for flat file paths. `instellingen.score.tsx` creates `/instellingen/score`. Using a folder `instellingen/score.tsx` also works but requires `instellingen.tsx` to have `<Outlet>`. Wrong choice will break the existing instellingen page.
**Why it happens:** TanStack Router file conventions differ from Next.js.
**How to avoid:** Use the flat dot-notation file `instellingen.score.tsx` as a SIBLING of `instellingen.tsx`. Both render inside `_authenticated` layout independently. No Outlet needed.

### Pitfall 6: Balance slider value conflicts with re-score idempotency
**What goes wrong:** If potentie/risico balance changes and re-score is triggered, the impact preview count (X up / Y down) must reflect BOTH weight changes AND balance formula changes. Computing delta against old `sr.score` is correct.
**Why it happens:** Re-score changes both `bijdrage` (via custom weights) AND `overall` (via new formula + balance).
**How to avoid:** Impact summary tracks `delta = new_overall - old_overall` per parcel. Return `{up: count(delta>0), down: count(delta<0), avg_delta: mean(delta)}`.

---

## Code Examples

### 4 New Factor Functions (pattern to follow)

```python
# score_v3_factors.py — add after score_max_hoogte_bereikt()

def score_natura2000(parcel_data: dict) -> FactorResult:
    """Factor R10: Natura2000 nabijheid (stikstof). Gewicht=5."""
    nat = parcel_data.get("natura2000")
    if not nat or not isinstance(nat, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=5,
            bijdrage=round(0.5 * 5, 4), categorie="risico",
            toelichting_kort="Natura2000 nabijheid onbekend — geen data",
            toelichting_lang="...",
            data_bronnen=["PDOK Natura2000 WFS"],
            missing=True,
        )
    binnen_5km = bool(nat.get("binnen_5km"))
    score = 1.0 if binnen_5km else 0.0
    naam = nat.get("naam") or "onbekend"
    kort = f"Natura2000 binnen 5km — {naam}" if binnen_5km else "Geen Natura2000 binnen 5km"
    lang = (
        f"Het gebied '{naam}' ligt binnen 5km van dit perceel. "
        "Stikstofuitstoot tijdens bouw (AERIUS-berekening) kan het vergunningstraject blokkeren. "
        "Dit is één van de meest voorkomende oorzaken voor vergunningsvertragingen in Nederland."
        if binnen_5km else
        "Er zijn geen Natura2000-gebieden binnen 5km. Het stikstofrisico is laag."
    )
    return FactorResult(
        waarde={"binnen_5km": binnen_5km, "naam": naam},
        genormaliseerde_score=score, gewicht=5,
        bijdrage=round(score * 5, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["PDOK Natura2000 WFS"],
        missing=False,
    )
```

### Custom weights application in score_v3.py

```python
def _apply_custom_weights(
    breakdown: dict[str, FactorResult],
    custom_weights: dict[str, Any],
) -> None:
    """Override factor gewichten from org custom config. Mutates in-place."""
    potentie_w = custom_weights.get("potentie_weights") or {}
    risico_w = custom_weights.get("risico_weights") or {}

    for name, factor in breakdown.items():
        weight_map = potentie_w if factor.categorie == "potentie" else risico_w
        if name in weight_map:
            new_weight = float(weight_map[name])
            factor.gewicht = new_weight
            factor.bijdrage = round(factor.genormaliseerde_score * new_weight, 4)
```

### New overall formula

```python
# In compute_score_v3(), replace:
#   overall = round(potentie_score - risico_score, 1)
# With:

balance = (custom_weights or {}).get("potentie_risico_balance", 0.7)
# balance = 0.7 means 70% weight on potentie, 30% risico discount contribution
MAX_DISCOUNT = 0.5
risico_discount = min(MAX_DISCOUNT, (risico_score / 100.0) * (1.0 - balance))
overall = round(potentie_score * (1.0 - risico_discount), 1)
overall = max(0.0, min(100.0, overall))
```

**Example:** potentie=70, risico=40, balance=0.7
- risico_discount = min(0.5, 0.40 × 0.3) = min(0.5, 0.12) = 0.12
- overall = 70 × (1 - 0.12) = 70 × 0.88 = 61.6

**Example:** potentie=50, risico=80, balance=0.7 (risk-averse org sets balance=0.4)
- With 0.4 balance: risico_discount = min(0.5, 0.80 × 0.6) = min(0.5, 0.48) = 0.48
- overall = 50 × (1 - 0.48) = 50 × 0.52 = 26.0

### Weight-only re-score in background job

```python
async def _rescore_from_breakdown(
    sr_flags: dict,
    custom_weights: dict,
    balance: float,
) -> tuple[float, float, float] | None:
    """Returns (potentie_score, risico_score, overall) or None if breakdown missing."""
    breakdown = sr_flags.get("score_breakdown")
    if not breakdown or not isinstance(breakdown, dict):
        return None

    # Verify v3.0 format (has 'categorie' key in first factor)
    first = next(iter(breakdown.values()), {})
    if "categorie" not in first:
        return None

    potentie_w = custom_weights.get("potentie_weights", {})
    risico_w = custom_weights.get("risico_weights", {})

    raw_potentie = 0.0
    raw_risico = 0.0
    pot_max = 0.0
    ris_max = 0.0

    for name, factor in breakdown.items():
        cat = factor.get("categorie")
        gs = float(factor.get("genormaliseerde_score", 0) or 0)
        weight_map = potentie_w if cat == "potentie" else risico_w
        w = float(weight_map.get(name, factor.get("gewicht", 0)))
        bijdrage = gs * w
        if cat == "potentie":
            raw_potentie += bijdrage
            pot_max += w
        elif cat == "risico":
            raw_risico += bijdrage
            ris_max += w

    if pot_max <= 0 or ris_max <= 0:
        return None

    potentie_score = min(100.0, (raw_potentie / pot_max) * 100)
    risico_score = min(100.0, (raw_risico / ris_max) * 100)

    MAX_DISCOUNT = 0.5
    risico_discount = min(MAX_DISCOUNT, (risico_score / 100.0) * (1.0 - balance))
    overall = min(100.0, max(0.0, potentie_score * (1.0 - risico_discount)))
    return round(potentie_score, 1), round(risico_score, 1), round(overall, 1)
```

### Frontend settings hook pattern

```typescript
// hooks/useScoreWeights.ts
export function useOrgScoreWeights() {
  const { accessToken } = useAuth()
  return useQuery<ScoreWeightsConfig, Error>({
    queryKey: ['org', 'score-weights'],
    queryFn: () => apiFetch<ScoreWeightsConfig>('/api/users/org/score-weights', { accessToken }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}

export function useSaveScoreWeights() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation<SaveScoreWeightsResponse, Error, SaveScoreWeightsRequest>({
    mutationFn: (data) =>
      apiFetch<SaveScoreWeightsResponse>('/api/users/org/score-weights', {
        accessToken,
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['org', 'score-weights'], data.weights)
    },
  })
}
```

---

## Preset Design (Claude's Discretion)

Four presets designed for the two target audiences (vastgoedontwikkelaars, kwaliteitsborgers):

**1. Standaard** (default)
- Balance: 70/30 (opportunity-first)
- All factors at system defaults
- "Gebalanceerde beoordeling voor algemeen gebruik"

**2. Snel Kansen Scouten**
- Balance: 85/15 (very opportunity-heavy)
- Potentie: vrije_grond+8, perceelgrootte+4, leegstand+5; overige potentie -2 each
- Risico: all weights −30% except funderingsrisico (unchanged)
- "Snel screenen op volumepotentie — risico als secundaire check"
- Target: scouts bij ontwikkelaars die grote aantallen parcelen snel filteren

**3. Risico-Averse Due Diligence**
- Balance: 50/50 (equal weight)
- Risico: funderingsrisico+6, bodemverontreiniging+4, natura2000+4, geluid+3
- Potentie: vergunning_succeskans+4, bestemming+4; funda_frictie −3
- "Grondige risicoanalyse voor aankoopbeslissingen"
- Target: kwaliteitsborgers, eindverantwoordelijken bij ontwikkelaars

**4. Stedelijke Transformatie**
- Balance: 65/35
- Potentie: optoppotentie+6, bestemming+4, vergunning_succeskans+5
- Risico: max_hoogte_bereikt+5, bestemmingswijziging+5, natura2000+2 (urban = less nature risk)
- "Geoptimaliseerd voor herontwikkeling van bestaande bebouwing in stedelijk gebied"
- Target: stadsvernieuwingsprojecten

---

## Impact Preview Design

The impact preview is shown after the re-score job completes. The `rescore_weights_job` returns a summary dict that the frontend polls for and displays.

**Job response shape:**
```json
{
  "processed": 137240,
  "up_count": 42150,
  "down_count": 28930,
  "unchanged_count": 66160,
  "avg_delta": 4.2,
  "max_increase": 18.5,
  "max_decrease": -12.3
}
```

**Frontend polling pattern:** Same as scan job — poll `GET /api/users/org/score-weights/job/{job_id}` at 2s interval until `status == "complete"` or timeout. ARQ Job object provides status. Show progress spinner with "Herberekening bezig..." text during poll.

**Impact display:** Simple stat row below the save button:
- "42.150 percelen omhoog (gem. +4.2pt)"
- "28.930 percelen omlaag"

---

## Open Questions

1. **Alembic migration: ADD COLUMN or new table?**
   - What we know: Organization model has 3 columns now. JSONB column is simplest.
   - What's unclear: If per-scan weights are added in a future phase, a normalized table would be better.
   - Recommendation: JSONB column on organizations now; migrate to table if per-scan weights are needed (deferred per CONTEXT.md).

2. **ARQ job polling: reuse scan job pattern or custom endpoint?**
   - What we know: Scan jobs use `GET /api/scans/{id}/status` with ARQ Job object.
   - What's unclear: Whether a separate job-status endpoint is needed for re-score.
   - Recommendation: Add `GET /api/users/org/score-weights/job/{job_id}` that wraps ARQ `Job` status — same pattern, 5 lines.

3. **category thresholds with new formula**
   - What we know: Old thresholds: Hoog >40, Gemiddeld >10, else Laag (on `overall = potentie - risico`).
   - What's unclear: New formula produces 0-100 (never negative). Thresholds need recalibration.
   - Recommendation: On 70/30 balance with average 50 potentie + 30 risico: overall ≈ 50 × (1 - 0.09) ≈ 45. Set Hoog >60, Gemiddeld >30, Laag ≤30.

4. **Custom profile badge placement**
   - What we know: Should appear "near score" in ParcelDetailPanel.
   - What's unclear: Exact component location — on ScoreGauge? On PotentieLayer verdict hero?
   - Recommendation: Small pill badge ("Custom profiel") below ScoreGauge SVG in ParcelBentoOverview, visible only when `orgUsesCustomWeights` (fetched from useOrgScoreWeights and stored in context/atom).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `overall = potentie - risico` | `overall = potentie × (1 - risico_discount)` | Phase 108 | Scores 0-100 (no negatives), useful differentiation |
| 9 risico factors | 13 risico factors (+4 env) | Phase 108 | Environmental risks finally in score |
| Hardcoded system weights | Per-org customizable weights | Phase 108 | Org-specific profiles, presets |
| _RISICO_MAX = 67 | _RISICO_MAX = 87 | Phase 108 | Absorbs 4 new factors |

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `backend/app/services/score_v3.py` — current formula, constants, FactorResult pattern
- Direct code inspection: `backend/app/services/score_v3_factors.py` — all 9 existing factor functions with gewicht values
- Direct code inspection: `backend/app/government_apis/pdok_natura2000.py`, `rws_overstromingen.py`, `rivm_geluid.py`, `rivm_luchtkwaliteit.py` — exact response shapes for new factors
- Direct code inspection: `backend/app/services/scan_enrichment.py` — confirms 4 env sources are fetched and stored as `natura2000`, `overstromingsrisico`, `geluid`, `luchtkwaliteit` in flags
- Direct code inspection: `backend/app/tools/backfill_scan_scores_v3.py` — confirms parcel_data assembly includes all 4 env keys
- Direct code inspection: `backend/app/models/organization.py` — current Organization model (3 columns, no score_weights yet)
- Direct code inspection: `frontend/src/routes/_authenticated/instellingen.tsx` — current settings page (4 sections, no tab nav)
- Direct code inspection: `frontend/src/hooks/useSettings.ts` — TanStack Query + apiFetch pattern for settings hooks
- Direct code inspection: `backend/app/jobs/worker.py` — ARQ WorkerSettings.functions list + job enqueue pattern

### Secondary (MEDIUM confidence)
- TanStack Router flat file convention (dot-notation): verified by inspecting existing route files (`rapport.$id.tsx`, `map.tsx` pattern in `_authenticated/`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, verified by checking package manifests and imports
- Architecture: HIGH — all patterns verified directly from existing code (factor functions, ARQ jobs, TanStack Router, settings hooks)
- Pitfalls: HIGH — weight constant pitfall verified from score_v3.py source; formula/tile pitfall verified from backfill tool; router pitfall verified from instellingen.tsx source
- Environmental factor data shapes: HIGH — verified directly from all 4 API client files

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable internal codebase, no fast-moving external libs)
