# Phase 01: Fundament + Demo-flag (M052/S01) - Research

**Researched:** 2026-05-21
**Domain:** FastAPI/SQLAlchemy backend extension + React frontend save-flow wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1 — projecttype hergebruikt bestaande org-scoped ParcelProjectType (FUND-01)**
- GEEN nieuwe kolom/migratie op `ParcelFavorite`. Single source of truth blijft `PUT /api/parcels/{parcel_id}/project-type`.
- Enum-mapping: `optoppen→optoppen`, `splitsen→splitsen`, `nieuwbouw→nieuwbouw_wonen`, `transformatie→transformatie_wonen`. Geen keuze = `onbepaald`.
- `commercieel_naar_wonen` mag maar zit niet in de 4 Hauzer-zoekmethoden.
- Twee users zelfde org = last-write-wins (`set_by_user_id` houdt bij wie). Per-favorite override DEFERRED.

**D2 — projecttype voedt M047 scoring + rescore-trigger (FUND-02)**
- Scoring consumeert projecttype via M047 conditional-weight-shift in `compute_score_v3`.
- Open werk: `PUT /project-type` triggert NIET automatisch een rescore — wire de bestaande `enqueue_rescore_parcel` in op de PUT. Zonder rescore faalt FUND-02 STIL.
- Dit MOET een test krijgen.

**D3 — HAUZER_DEMO = smalle per-org boolean (DEMO-01)**
- `hauzer_demo` boolean op `Organization` (default `false`, NOT NULL), patroon `expose_score_internals`.
- Uitgelezen via `/api/auth/me` (org-context toevoegen aan de me-response).
- Demo-login = `demo@klarifai.nl` in de demo-org (S06 seedt die org). NIET `info@klarifai.nl`.
- Multi-tenant: andere orgs krijgen NOOIT `hauzer_demo:true`.
- GEEN env kill-switch.

**D4 — DESIGN.md makelaars-correctie (DEMO-03)**
- `DESIGN.md:13` — "Brainbay/NVM (makelaars — NIET onze markt)" corrigeren naar: makelaars zijn WEL onze markt (Hauzer = full-service developer-adjacent).

### Claude's Discretion
- Exacte plek/vorm zoekmethode-picker (modal na opslaan via HeartButton success, of inline). Bestaande `ProjectTypePickerModal` mag hergebruikt worden.
- Exacte vorm org-context-uitbreiding op `/api/auth/me` (veld op me-response vs genest org-object).
- `useHauzerDemo()` hook-implementatie (context-provider vs query).
- Of `FavoriteResponse` het projecttype gedenormaliseerd meekrijgt.

### Deferred Ideas (OUT OF SCOPE)
- Per-favorite projecttype-override.
- `use_case_scoring.py` USE_CASE_PRESETS enum-mismatch (4 vs 6) — pre-existing M047-seam.
- Volledige M050.5 tier-enum (demo/paid/superadmin).
- HAUZER_DEMO env kill-switch.
- Fix woonvisie cascade-testfouten (pre-existing on main).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FUND-01 | Gebruiker kiest bij opslaan een zoekmethode (optoppen/nieuwbouw/transformatie/splitsen), opgeslagen als projecttype via bestaande ParcelProjectType PUT | HeartButton success-callback → ProjectTypePickerModal → useUpdateParcelProjectType confirmed functional |
| FUND-02 | Gekozen projecttype stuurt de scoring via bestaande M047 projecttype-settings | compute_score_v3 accepts project_type param; rescore_parcel job does NOT currently pass it — gap confirmed, wire location identified |
| DEMO-01 | HAUZER_DEMO feature-flag gate voor alle mock-surfaces | Organization model + auth/me endpoint + UserResponse schema locations all confirmed |
| DEMO-03 | DESIGN.md makelaars-correctie | Line 13 of DESIGN.md confirmed; single-line edit |
</phase_requirements>

---

## Summary

S01 is a pure wiring slice — no new architectural patterns, no new services. All four requirements hook into already-shipped infrastructure. The research resolves five concrete implementation gaps the eng-review deferred.

The most important finding is FUND-02: `rescore_parcel` (the existing M050/S03 ARQ job at `backend/app/jobs/rescore_cascade_job.py:341`) calls `compute_score_v3(flags)` without passing `project_type`, so it always computes with the "onbepaald" default weights regardless of what the user chose. The fix is a two-line change: load the ParcelProjectType row inside the job and pass it to `compute_score_v3`. The `PUT /project-type` endpoint must then enqueue this job (same pattern as BRK's `enqueue_rescore_parcel` call in `brk_router.py:106`).

The DEMO-01 work (hauzer_demo boolean) is straightforward: one Alembic migration, one boolean column on Organization, one field added to `UserResponse` Pydantic schema and the `/me` route. The frontend reads it from the existing `/api/auth/me` call with zero new round-trips.

**Primary recommendation:** Implement in this order: (1) migration first (unblocks all other work), (2) PUT endpoint rescore wiring (FUND-02 — highest risk of silent failure), (3) HeartButton success picker (FUND-01), (4) hauzer_demo in /me (DEMO-01), (5) DESIGN.md edit (DEMO-03).

---

## Standard Stack

### Core (already present — no new deps)

| Component | File | Version/Pattern |
|-----------|------|----------------|
| SQLAlchemy 2.x ORM | `app/models/organization.py` | `Mapped[bool]` + `mapped_column(Boolean, ...)` |
| Alembic | `backend/alembic/versions/` | Date-based prefix: `YYYYMMDD_m052_s01_<desc>.py` |
| FastAPI | `app/auth/router.py` | `@router.get("/me", response_model=UserResponse)` |
| Pydantic v2 | `app/auth/schemas.py` | `model_config = ConfigDict(from_attributes=True)` |
| ARQ | `app/core/arq.py` | `get_arq_pool` FastAPI dependency, `enqueue_job()` |
| TanStack Query | `frontend/src/hooks/useFavorites.ts` | `useMutation` + `onSuccess` callback pattern |
| React + TypeScript | `frontend/src/lib/auth/types.ts` | `User` interface, extend in place |

### No new dependencies

This phase touches only existing infrastructure. Do NOT add any packages.

---

## Architecture Patterns

### Pattern 1: Boolean column on Organization (DEMO-01)

Follow the `expose_score_internals` pattern exactly (`organization.py:44`):

```python
# Source: backend/app/models/organization.py:44-53
expose_score_internals: Mapped[bool] = mapped_column(
    Boolean,
    nullable=False,
    server_default=text("false"),
    comment="...",
)
```

New column:

```python
hauzer_demo: Mapped[bool] = mapped_column(
    Boolean,
    nullable=False,
    server_default=text("false"),
    comment=(
        "M052/S01 — per-org gate for mock surfaces (DASH-04, MATCH-01, "
        "NAV-04, CONTACT-02-send). Default False for all orgs. "
        "S06 sets True on demo-org only. No env kill-switch (YAGNI pre-prod)."
    ),
)
```

### Pattern 2: Alembic migration (one column)

Current head: `20260519_m050_s02` (file `20260519_m050_s02_brk_latest_index.py`, `down_revision = "20260518_m050_s01"`).

New migration filename: `20260521_m052_s01_add_org_hauzer_demo.py`

```python
# revision: "20260521_m052_s01"
# down_revision: "20260519_m050_s02"

def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "hauzer_demo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

def downgrade() -> None:
    op.drop_column("organizations", "hauzer_demo")
```

### Pattern 3: /me endpoint org-context extension (DEMO-01)

**Route:** `backend/app/auth/router.py:143`

```python
# Current (router.py:143-148)
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)
```

`current_user` is a `User` ORM object. `User.organization_id` is always set (NOT NULL). The dependency chain (`get_current_active_user` → `get_current_user` in `dependencies.py:20`) loads the `User` row but NOT the `Organization` row.

**Two options (Claude's Discretion):**

Option A — flat field on UserResponse (recommended: minimal change, no join):
Add `hauzer_demo: bool = False` to `UserResponse` in `auth/schemas.py`, add a `db` dependency to `get_me`, do a targeted `SELECT Organization.hauzer_demo WHERE id = current_user.organization_id`.

Option B — pass `hauzer_demo` directly on `User` model by loading org in dependency.

Option A is recommended: surgical, no change to the dependency chain, `UserResponse` already has `organization_id` so the frontend already knows the org without a nested object.

```python
# schemas.py — add to UserResponse:
hauzer_demo: bool = False
```

```python
# router.py — extend get_me:
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    from sqlalchemy import select
    result = await db.execute(
        select(Organization.hauzer_demo).where(Organization.id == current_user.organization_id)
    )
    hauzer_demo = bool(result.scalar_one_or_none() or False)
    data = UserResponse.model_validate(current_user)
    data.hauzer_demo = hauzer_demo
    return data
```

Note: `UserResponse` uses `from_attributes=True`; adding a plain `bool` field with default `False` does not break existing callers.

### Pattern 4: FUND-02 — rescore_parcel must pass project_type

**The gap (confirmed):** `rescore_cascade_job.py:341`:

```python
# Current — always uses default "onbepaald":
score_result = compute_score_v3(flags)
```

`compute_score_v3` signature (`score_v3.py:445-450`):

```python
def compute_score_v3(
    parcel_data: dict[str, Any],
    neighborhood_metrics: dict[str, Any] | None = None,
    custom_weights: dict[str, Any] | None = None,
    project_type: str = "onbepaald",
    cascade_payloads: dict[str, Any] | None = None,
) -> ScoreV3Result:
```

**Fix:** Inside `rescore_parcel` (before the `compute_score_v3` call), load the ParcelProjectType row for `(org_uuid, parcel_id)` and pass it:

```python
# Immediately before compute_score_v3 call (line ~341):
from app.services.parcel_project_type_service import get_project_type

pt_response = await get_project_type(db, parcel_id=parcel_id, organization_id=org_uuid)
project_type_value = pt_response.project_type  # "onbepaald" when not set

score_result = compute_score_v3(flags, project_type=project_type_value)
```

**Enqueue trigger:** `PUT /api/parcels/{parcel_id}/project-type` (`parcel_project_type_router.py:49`) must enqueue `rescore_parcel` after the upsert, using the same pattern as `brk_router.py:103-118`:

```python
# parcel_project_type_router.py — extend update_parcel_project_type:
from app.core.arq import get_arq_pool
from app.jobs.rescore_cascade_job import enqueue_rescore_parcel
from arq.connections import ArqRedis

@router.put("/{parcel_id}/project-type", response_model=ProjectTypeResponse)
async def update_parcel_project_type(
    parcel_id: str,
    body: ProjectTypeUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    arq_pool: ArqRedis = Depends(get_arq_pool),
) -> ProjectTypeResponse:
    result = await parcel_project_type_service.upsert_project_type(...)
    # Best-effort enqueue — NEVER blocks the 200 response
    try:
        await enqueue_rescore_parcel(
            arq_pool=arq_pool,
            organization_id=current_user.organization_id,
            parcel_id=parcel_id,
        )
    except Exception as exc:
        logger.warning("enqueue_rescore_parcel failed (non-blocking) parcel=%s err=%s", parcel_id, exc)
    return result
```

This uses the existing ARQ job-id dedup (`rescore:{org}:{parcel}`) so rapid sequential PUTs collapse to one execution.

### Pattern 5: HeartButton success → picker wiring (FUND-01)

**Current flow** (`HeartButton.tsx:38`):

```typescript
onClick={() => toggleFavorite.mutate({ parcel, isFavorited, gemeenteNaam, wijkNaam })}
```

`useToggleFavorite` (`useFavorites.ts:156`) has an `onSuccess` callback that fires `generateReportFromParcel` when adding a new favorite.

**Insertion point:** After `toggleFavorite.mutate` resolves to a successful add (i.e., `isFavorited` was `false` and `data !== null`), show the `ProjectTypePickerModal`. The cleanest way:

Add `showPicker` local state to `HeartButton` (or a parent component if HeartButton needs to stay <150 lines). On `onSuccess` of a newly-added favorite: set `showPicker=true`. The modal calls `useUpdateParcelProjectType` (PUT endpoint) directly and on success/skip, sets `showPicker=false`.

`ProjectTypePickerModal` already exists (`frontend/src/components/parcel/ProjectTypePickerModal.tsx`) — it accepts `open`, `onClose`, `parcelId`, `currentType`, `onSkip`.

**Enum mapping** (4 Hauzer zoekmethoden to canonical enum, CONTEXT.md D1):

| UI label (NL) | canonical ProjectType enum |
|---------------|---------------------------|
| Optoppen | `optoppen` |
| Nieuwbouw | `nieuwbouw_wonen` |
| Transformatie | `transformatie_wonen` |
| Splitsen | `splitsen` |
| (geen keuze/Later) | `onbepaald` (default; no PUT call) |

The existing `ProjectTypePickerModal` shows 5 pills (`SELECTABLE_TYPES` includes `commercieel_naar_wonen`). For FUND-01, the 4-pill Hauzer subset is sufficient — `commercieel_naar_wonen` can stay visible (enum is valid) or be gated behind `useHauzerDemo()` in a later slice. The plan may decide either way (Claude's Discretion).

### Pattern 6: useHauzerDemo() hook (DEMO-01)

Frontend reads `hauzer_demo` from the `/api/auth/me` response. The `User` interface (`frontend/src/lib/auth/types.ts:1`) and `AuthContextValue` need `hauzer_demo: boolean` added to `User`. Then:

```typescript
// frontend/src/hooks/useHauzerDemo.ts (new file)
import { useAuth } from '@/lib/auth/useAuth'

export function useHauzerDemo(): boolean {
  const { user } = useAuth()
  return user?.hauzer_demo ?? false
}
```

This is the simplest form (no extra query, derives from already-loaded auth state). Satisfies the constraint that other orgs always get `false`.

### Recommended Project Structure (new files only)

```
backend/
  alembic/versions/
    20260521_m052_s01_add_org_hauzer_demo.py   # migration
  tests/
    integration/
      test_m052_s01_hauzer_demo.py             # DEMO-01 integration tests
    regression/
      test_m052_s01_project_type_rescore.py    # FUND-02 iron-rule regression
frontend/
  src/
    hooks/
      useHauzerDemo.ts                         # DEMO-01 hook (new)
    lib/
      auth/
        types.ts                               # add hauzer_demo to User
```

### Anti-Patterns to Avoid

- **Do NOT add a column to `ParcelFavorite`** — locked in D1. Org-scope lives on ParcelProjectType.
- **Do NOT add an env var HAUZER_DEMO** — locked in D3. Flag is DB-only.
- **Do NOT raise an exception from the enqueue path** — follow best-effort try/except pattern from `brk_router.py:103-118`. The 200 response must never be blocked by ARQ.
- **Do NOT load Organization eagerly in `get_current_user`** — this runs on every authenticated request. The single scalar query inside `get_me` is the right scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-parcel rescore trigger | Custom rescore endpoint | `enqueue_rescore_parcel` from `rescore_cascade_job.py:374` | Already handles ARQ dedup via `_job_id`, best-effort pattern, worker bootstrapping |
| ARQ pool access | `request.app.state.arq_pool` directly | `get_arq_pool` FastAPI dep (`core/arq.py`) | Centralised, testable via `app.state.arq_pool = AsyncMock(...)` |
| Org flag lookup | Join on User | Targeted `SELECT Organization.hauzer_demo WHERE id = ?` | One scalar query, no ORM relationship needed, no risk of loading full org in all auth paths |
| Project type upsert | Custom INSERT/UPDATE | `parcel_project_type_service.upsert_project_type` | Already handles pg_insert ON CONFLICT DO UPDATE atomically |

---

## Common Pitfalls

### Pitfall 1: rescore_parcel passes wrong DB session to get_project_type
**What goes wrong:** `rescore_parcel` creates its own `session_factory` inside the ARQ worker (own engine). If you import `get_project_type` and pass the wrong session, you may query outside the worker's session scope.
**How to avoid:** Use the same `db` session already open inside `async with session_factory() as db:` at line ~314. Call `get_project_type(db, ...)` within that same context block, before the `compute_score_v3` call.

### Pitfall 2: hauzer_demo field added to UserResponse but not Pydantic model_validate
**What goes wrong:** `UserResponse.model_validate(current_user)` only pulls fields from the `User` ORM object. `hauzer_demo` is not on `User`, so Pydantic will silently ignore it and return the default `False` even after db query.
**How to avoid:** After calling `model_validate`, set the field directly: `data.hauzer_demo = hauzer_demo` (as shown in Pattern 3 above). The schema field must have `default=False` (not required) so the model validates without it.

### Pitfall 3: onSuccess in useToggleFavorite fires even on DELETE
**What goes wrong:** The `onSuccess` callback in `useFavorites.ts:156` fires on both add AND the no-op return from delete. Showing the picker on delete would be wrong.
**How to avoid:** Gate on `!isFavorited && data !== null` (already the pattern in the existing `generateReportFromParcel` call at line 158). Mirror this check for the picker.

### Pitfall 4: Migration down_revision must be 20260519_m050_s02
**What goes wrong:** Using an older revision ID (e.g., the old `bbdb5c6ff811` or `657143b79099` — both appear in STATE.md history) will break Alembic's chain.
**How to avoid:** Confirmed current head is `20260519_m050_s02` (file `20260519_m050_s02_brk_latest_index.py`). New migration `down_revision = "20260519_m050_s02"`.

### Pitfall 5: get_me now needs db — don't forget to add it to the router
**What goes wrong:** Adding `db: AsyncSession = Depends(get_db)` to `get_me` without importing `get_db` in `router.py` causes a startup ImportError.
**How to avoid:** `get_db` is already imported in `router.py` indirectly (or add `from app.core.database import get_db` explicitly — it's already used across all other routers).

---

## Code Examples

### How enqueue_rescore_parcel is called today (BRK precedent)

```python
# Source: backend/app/scans/brk_router.py:103-118
try:
    await enqueue_rescore_parcel(
        arq_pool=arq_pool,
        organization_id=current_user.organization_id,
        parcel_id=parcel_id,
    )
except Exception as exc:
    logger.warning(
        "M050/S03 D7 enqueue_rescore_parcel failed (non-blocking) "
        "parcel=%s org=%s err=%s",
        parcel_id,
        current_user.organization_id,
        exc,
    )
```

### How compute_score_v3 consumes project_type (confirmed working)

```python
# Source: backend/app/jobs/area_scan.py:967-970
v3_result = compute_score_v3(
    flags,
    project_type="onbepaald",  # S02 UI sets per-parcel projecttype later
)
```

The comment "S02 UI sets per-parcel projecttype later" confirms this was always the planned wiring point. The area_scan job passes `"onbepaald"` at scan-time (correct — user hasn't chosen yet). `rescore_parcel` should pass the actual stored value.

### How expose_score_internals boolean flag is read in a dependency

```python
# Source: backend/app/auth/dependencies.py:149-165
async def get_current_org_expose_score_internals(
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    result = await db.execute(
        select(Organization.expose_score_internals).where(
            Organization.id == organization_id
        )
    )
    flag = result.scalar_one_or_none()
    return bool(flag) if flag is not None else False
```

The `hauzer_demo` query in `get_me` should follow this exact scalar pattern.

### HeartButton success → picker (sketch, final form is Claude's Discretion)

```typescript
// frontend/src/components/map/panels/parcel/HeartButton.tsx
// Add local state for picker:
const [showPicker, setShowPicker] = useState(false)

// In mutate call, pass onSuccess:
toggleFavorite.mutate(
  { parcel, isFavorited, gemeenteNaam, wijkNaam },
  {
    onSuccess: (data) => {
      // Only show picker on NEW favorite (not on delete)
      if (!isFavorited && data !== null) {
        setShowPicker(true)
      }
    },
  }
)

// After the button JSX, render the modal:
{showPicker && (
  <ProjectTypePickerModal
    open={showPicker}
    onClose={() => setShowPicker(false)}
    parcelId={parcel.parcel_code}
    currentType={null}
    onSkip={() => setShowPicker(false)}
  />
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `area_scan.py` always uses `project_type="onbepaald"` at scan-time | Will remain "onbepaald" at scan-time; rescore_parcel will use stored value | S01 (this phase) | Headline score reflects chosen strategy immediately after save |
| `/me` returns User-only data (no org fields) | `/me` will return `hauzer_demo` field inline on UserResponse | S01 (this phase) | Frontend gate for mock surfaces needs no extra round-trip |

**Deprecated/outdated:**
- The comment in `area_scan.py:970` ("S02 UI sets per-parcel projecttype later") is partially wrong — S01 (not S02) wires the save-flow picker. The comment can be updated but it is not load-bearing.

---

## Open Questions

1. **HeartButton file size after picker addition**
   - What we know: `HeartButton.tsx` is currently 48 lines — well under the 300-line limit.
   - What's unclear: If `useState` + `ProjectTypePickerModal` import pushes it past a design threshold.
   - Recommendation: Add picker state directly in HeartButton — 48 + ~15 lines = ~63 lines, well within limits.

2. **Should useToggleFavorite expose onSuccess to callers?**
   - What we know: `mutate()` accepts a second argument with `{onSuccess, onError, onSettled}` per TanStack Query API, which HeartButton can use without modifying the hook itself.
   - What's unclear: Nothing — this is how HeartButton already uses the mutation per the existing `generateReportFromParcel` pattern.
   - Recommendation: Use the per-call `onSuccess` option, do NOT modify `useToggleFavorite` signature.

3. **Should project_type be stamped in flags for future cache-roundtrip?**
   - What we know: `rescore_parcel` stamps `m050_s03_factors_at` and `cascade_rescored_at` in flags. There is no current `project_type_at` stamp.
   - What's unclear: Whether downstream consumers (S02 Haalbaarheid checklist) need to know what projecttype was active when the score was computed.
   - Recommendation: Keep it minimal in S01 — the score breakdown already reflects the projecttype through weight shifts. Stamp only if S02 explicitly needs it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest-asyncio 0.21+, asyncio_mode="auto" |
| Config file | `backend/pyproject.toml` (section `[tool.pytest.ini_options]`) |
| Quick run command | `cd backend && python -m pytest tests/integration/test_m052_s01_hauzer_demo.py tests/regression/test_m052_s01_project_type_rescore.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x --ignore=tests/eval` |
| Frontend check | `cd frontend && npm run check` |
| Frontend unit tests | `cd frontend && npx vitest run --project unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FUND-01 | HeartButton success → picker shown → PUT project-type called | Frontend unit (node-env) | `npx vitest run --project unit src/hooks/__tests__/useToggleFavorite.test.ts` | Wave 0 |
| FUND-02 | PUT project-type enqueues rescore_parcel (best-effort) | Integration + Regression | `pytest tests/integration/test_m052_s01_hauzer_demo.py::test_put_project_type_enqueues_rescore -x` | Wave 0 |
| FUND-02 | rescore_parcel passes stored project_type to compute_score_v3 | Regression (iron-rule) | `pytest tests/regression/test_m052_s01_project_type_rescore.py -x` | Wave 0 |
| DEMO-01 | GET /auth/me returns hauzer_demo=false for normal org | Integration | `pytest tests/integration/test_m052_s01_hauzer_demo.py::test_me_returns_hauzer_demo_false -x` | Wave 0 |
| DEMO-01 | Two orgs: org with flag=true gets true, other org gets false | Multi-tenant regression | `pytest tests/regression/test_m052_s01_project_type_rescore.py::test_hauzer_demo_multi_tenant_isolation -x` | Wave 0 |
| DEMO-03 | DESIGN.md line 13 no longer contains "NIET onze markt" | Static grep | `grep -n "NIET onze markt" DESIGN.md | grep makelaars` returns empty | Manual/Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/integration/test_m052_s01_hauzer_demo.py tests/regression/test_m052_s01_project_type_rescore.py -x && cd frontend && npm run check`
- **Per wave merge:** Full backend suite + `npx vitest run --project unit`
- **Phase gate:** Full suite green (no NEW failures vs pre-existing baseline of ~103 backend failures from woonvisie/event-loop issue) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_m052_s01_hauzer_demo.py` — covers DEMO-01 (GET /me hauzer_demo field) + FUND-02 (PUT project-type triggers enqueue)
- [ ] `backend/tests/regression/test_m052_s01_project_type_rescore.py` — iron-rule: rescore_parcel uses project_type from DB; multi-tenant hauzer_demo isolation
- [ ] `frontend/src/hooks/__tests__/useToggleFavorite.test.ts` — FUND-01: picker shown on save success, not on delete

Note: existing `tests/integration/test_parcel_project_type_router.py` already covers the PUT/GET contract (5 tests) — no duplication needed.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `backend/app/jobs/rescore_cascade_job.py:341` — `compute_score_v3(flags)` without project_type (confirmed gap)
- Direct code read: `backend/app/services/score_v3.py:445-449` — `project_type: str = "onbepaald"` parameter confirmed
- Direct code read: `backend/app/scans/brk_router.py:103-118` — `enqueue_rescore_parcel` best-effort pattern (confirmed template)
- Direct code read: `backend/app/auth/router.py:143-148` — `/me` endpoint, `UserResponse.model_validate(current_user)` (confirmed)
- Direct code read: `backend/app/auth/schemas.py:20-32` — `UserResponse` fields (no hauzer_demo today, confirmed)
- Direct code read: `backend/app/models/organization.py:44-53` — `expose_score_internals` boolean pattern (confirmed template for hauzer_demo)
- Direct code read: `backend/alembic/versions/20260519_m050_s02_brk_latest_index.py` — confirmed current head revision `20260519_m050_s02`
- Direct code read: `frontend/src/components/map/panels/parcel/HeartButton.tsx` — 48 lines, success callback pattern confirmed
- Direct code read: `frontend/src/components/parcel/ProjectTypePickerModal.tsx` — existing modal confirmed, accepts `open/onClose/parcelId/currentType/onSkip`
- Direct code read: `frontend/src/hooks/useFavorites.ts:156-169` — existing `onSuccess` / `generateReportFromParcel` pattern
- Direct code read: `frontend/src/lib/auth/types.ts` — `User` interface (no hauzer_demo today, confirmed)
- Direct code read: `DESIGN.md:13` — line to correct confirmed

### Secondary (MEDIUM confidence)
- `backend/app/jobs/area_scan.py:967-970` — comment confirming "S02 UI sets projecttype later" was always the plan

---

## Metadata

**Confidence breakdown:**
- FUND-01 (save-flow picker): HIGH — all files read, pattern clear, no ambiguity
- FUND-02 (rescore wiring): HIGH — gap confirmed line-by-line, fix is a 2-line change + router extension
- DEMO-01 (hauzer_demo): HIGH — Organization model, /me route, UserResponse all verified
- DEMO-03 (DESIGN.md): HIGH — single line confirmed

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 (stable infrastructure, nothing fast-moving)
