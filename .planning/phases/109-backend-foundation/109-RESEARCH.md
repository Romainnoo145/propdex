# Phase 109: Backend Foundation - Research

**Researched:** 2026-03-15
**Domain:** FastAPI + SQLAlchemy 2.x backend — new table, CRUD API, and grouped portfolio query
**Confidence:** HIGH

## Summary

Phase 109 adds the `parcel_favorites` table with pipeline stage tracking, plus two new API prefixes (`/api/parcels/favorites` and `/api/portfolio`). Everything needed to implement this already exists in the codebase — the patterns are identical to what Phase 106 (`parcel_documents`) and the Projects router already use.

The main design decision is the data model for parcel identification. `parcel_cache.parcel_id` stores Kadaster strings (e.g., `"HTT02-A-1234"`, `String(50)`). The `ParcelFavorite` model stores the same string directly — no FK to `parcel_cache` is needed because favorites must survive a cache flush, and the portfolio query groups by `gemeente_code` + `wijk_naam` which are denormalized into the favorite at write time.

The portfolio endpoint's province-level grouping is a pure frontend concern: the backend returns `gemeente_code`, and the frontend resolves `gemeente_code → provincie` using its existing `provincieGeojson` lookup (CBS boundaries already loaded in ProjectList.tsx). The backend endpoint does **not** need to store or return a `provincie_code`.

**Primary recommendation:** Copy Phase 106 structure exactly (model → migration → router → schemas), add a `pipeline_stage` String(30) column with an enum-like Python Literal type, and implement the portfolio endpoint as a single `SELECT ... GROUP BY gemeente_code, wijk_naam` query with `COUNT(*)` — no subqueries needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.x (project standard) | ORM model + `Mapped[type]` + `mapped_column()` | Already in use throughout codebase |
| Alembic | project version | Schema migration | All previous tables used this |
| FastAPI | project version | Router with Depends injection | All existing routers follow this pattern |
| Pydantic v2 | project version | Request/response schemas with `ConfigDict(from_attributes=True)` | Consistent with all existing schemas |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `slowapi` (limiter) | project version | Rate limiting decorator | All API endpoints use `@limiter.limit("N/minute")` |
| `sqlalchemy.dialects.postgresql.JSONB` | — | Storing `afgerond_reden` payload | Only if Afgerond reason stored in Phase 109; see note below |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String(30) pipeline_stage | PostgreSQL ENUM type | String(30) follows Phase 106 `document_type` precedent — "easy category evolution without migrations" (STATE.md decision) |
| FK to parcel_cache.id | Denormalized Kadaster string | FK would break if parcel_cache row is evicted; denormalized string is durable |
| Provincie in DB | Derive at query time from gemeente_code | Gemeente-to-provincie mapping changes rarely; frontend already resolves it; storing it is redundant |

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── models/
│   └── parcel_favorite.py          # NEW: ParcelFavorite model
├── models/__init__.py               # Add ParcelFavorite import + __all__
├── alembic/versions/
│   └── h8c9d0e1f2g3_create_parcel_favorites_table.py  # NEW migration
└── parcels/                         # NEW module (router + schemas)
    ├── __init__.py
    ├── router.py                    # /api/parcels/favorites CRUD + /api/portfolio
    └── schemas.py                   # FavoriteCreate, FavoriteResponse, PortfolioResponse
```

Register in `backend/app/main.py` alongside existing routers.

### Pattern 1: Model — follows ParcelDocument

```python
# Source: backend/app/models/parcel_document.py (direct codebase reference)
class ParcelFavorite(Base, TenantMixin, TimestampMixin):
    __tablename__ = "parcel_favorites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    parcel_id: Mapped[str] = mapped_column(String(50), nullable=False, comment="Kadaster parcel ID (e.g. HTT02-A-1234)")
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    gemeente_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gemeente_naam: Mapped[str | None] = mapped_column(String(100), nullable=True)
    wijk_naam: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pipeline_stage: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'Gesignaleerd'"))

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "parcel_id", name="uq_parcel_favorites_org_user_parcel"),
        Index("ix_parcel_favorites_org_user", "organization_id", "user_id"),
        Index("ix_parcel_favorites_org_gemeente", "organization_id", "gemeente_code"),
    )
```

**Why user_id FK CASCADE DELETE:** If a user leaves the org their personal favorites are deleted. Org deletion cascades via TenantMixin's `organization_id` FK.

**Why UniqueConstraint on (org, user, parcel):** Prevents duplicate favorites per user per org. POST returns 200 with existing record instead of 409 (idempotent) OR 409 — choose 409 for simplicity.

### Pattern 2: Router — follows projects/router.py

```python
# Source: backend/app/projects/router.py (codebase reference)
router = APIRouter(prefix="/api/parcels", tags=["Favorites"])

@router.post("/favorites", response_model=FavoriteResponse, status_code=201)
@limiter.limit("30/minute")
async def add_favorite(
    request: Request,
    body: FavoriteCreate,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    ...
```

Portfolio endpoint uses a **separate router prefix** to keep concerns clean:

```python
portfolio_router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])
```

Both routers registered in `main.py`.

### Pattern 3: Portfolio Grouped Query — single query, no N+1

```python
# SQLAlchemy 2.x group-by pattern
from sqlalchemy import func, select

query = (
    select(
        ParcelFavorite.gemeente_code,
        ParcelFavorite.gemeente_naam,
        ParcelFavorite.wijk_naam,
        func.count(ParcelFavorite.id).label("parcel_count"),
    )
    .where(ParcelFavorite.organization_id == organization_id)
    .group_by(
        ParcelFavorite.gemeente_code,
        ParcelFavorite.gemeente_naam,
        ParcelFavorite.wijk_naam,
    )
    .order_by(ParcelFavorite.gemeente_naam, ParcelFavorite.wijk_naam)
)
result = await db.execute(query)
rows = result.all()
```

This produces one row per (gemeente, wijk) pair with a count — exactly what BACK-04 requires. Zero N+1.

### Pattern 4: Alembic Migration — follows 3882c5c83b07

- Include RLS policy matching existing pattern (`tenant_isolation_<tablename>`)
- Standard column ordering: id, domain columns, organization_id (from TenantMixin), created_at/updated_at (from TimestampMixin)
- `down_revision` points to `g7b8c9d0e1f2` (latest migration as of 2026-03-14)

### Pattern 5: Transaction Pattern — PROJECT CRITICAL

**From MEMORY.md:** Use `db.add()` / `db.flush()` / `db.commit()` directly. **Never** use `async with db.begin()` — causes "transaction already begun" error.

### Pattern 6: Pipeline Stage Validation

The `PATCH /api/parcels/favorites/{parcel_id}/pipeline` endpoint must return 400 for invalid stages. Use a Literal type in Pydantic + Python-level validation (no DB constraint needed):

```python
from typing import Literal
PipelineStage = Literal["Gesignaleerd", "Onderzoek", "Contact", "Besluit", "Afgerond"]

class PipelineUpdateRequest(BaseModel):
    stage: PipelineStage  # Pydantic validates automatically → 422 for invalid values
```

Note: The success criterion says "400 returned for invalid stage values" but Pydantic 422 is semantically more correct for validation errors. Use Pydantic Literal — it produces 422 (unprocessable entity), which FastAPI maps through. The plan can document this as "422 for invalid stage (Pydantic validation)".

### Anti-Patterns to Avoid

- **FK to parcel_cache.id:** Do not add a FK from `parcel_favorites.parcel_id` to `parcel_cache`. Parcel cache rows can be evicted; favorites must survive. Store the Kadaster string directly.
- **Storing provincie in DB:** Gemeente-to-province mapping is a frontend concern (CBS GeoJSON already loaded). Storing it creates denormalization churn with no query benefit since the portfolio endpoint groups by gemeente only.
- **N+1 in portfolio endpoint:** Do not query counts per-gemeente then per-wijk separately. One GROUP BY query with both levels returns all data at once.
- **Blocking duplicate favorites silently:** The UniqueConstraint means duplicate POSTs should either return the existing favorite (GET-or-create) or 409. Choose one and be consistent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID generator | `server_default=text("gen_random_uuid()")` | Already in every model |
| Tenant isolation | Manual WHERE clause | TenantMixin + RLS policy | Defense in depth, consistent pattern |
| Rate limiting | Manual throttle | `@limiter.limit("N/minute")` | slowapi already wired to app |
| Timestamp management | Manual datetime | TimestampMixin | `created_at`/`updated_at` auto-maintained |

## Common Pitfalls

### Pitfall 1: Datetime Type Mismatch

**What goes wrong:** Using `datetime.now(timezone.utc)` in Python when the DB column is `TIMESTAMP WITHOUT TIME ZONE`.
**Why it happens:** SQLAlchemy rejects timezone-aware datetimes against naive columns.
**How to avoid:** Use `datetime.utcnow()` (naive UTC) — already documented in MEMORY.md.
**Warning signs:** `ProgrammingError: can't adapt type datetime (timezone-aware)` at runtime.

### Pitfall 2: Transaction Already Begun

**What goes wrong:** Using `async with db.begin()` inside an endpoint that already has an open transaction from the session factory.
**Why it happens:** The session is created with autobegin; nesting begin() causes the error.
**How to avoid:** Use `db.add()` / `await db.commit()` directly (project-wide pattern, MEMORY.md).
**Warning signs:** `InvalidRequestError: A transaction is already begun on this Session`.

### Pitfall 3: Missing parcel_id URL-encode edge case

**What goes wrong:** Kadaster parcel IDs like `"HTT02-A-1234"` contain hyphens. FastAPI path parameters handle hyphens fine, but if the parcel_id is passed URL-encoded (`%2D`) the path won't match.
**How to avoid:** Use a body parameter for DELETE rather than a path parameter, OR declare the path parameter type as `str` (not UUID). The success criterion specifies `DELETE /api/parcels/favorites/{parcel_id}` which is fine for hyphens.

### Pitfall 4: Duplicate favorite on re-POST

**What goes wrong:** If a user re-favorites a parcel the DB raises IntegrityError from UniqueConstraint.
**How to avoid:** Catch `IntegrityError` and either return 409 or return the existing record. Document the choice in the plan. Idempotent (return existing) is better UX for Phase 110's optimistic UI.

### Pitfall 5: wijk_naam from wrong source

**What goes wrong:** The frontend passes wijk_naam from the parcel detail panel context. If the backend tries to look it up from `area_scans` at write time, there could be multiple scans for the same parcel (different wijk scans). The parcel_cache does NOT store wijk_naam.
**How to avoid:** Accept `wijk_naam` and `gemeente_naam` as request body fields from the frontend when creating a favorite. The frontend already has this context from the active scan. Store them denormalized on the favorite row.

## Code Examples

### FavoriteCreate request schema

```python
from pydantic import BaseModel, ConfigDict, Field

class FavoriteCreate(BaseModel):
    parcel_id: str = Field(description="Kadaster parcel ID (e.g. HTT02-A-1234)")
    gemeente_code: str | None = Field(default=None, max_length=10)
    gemeente_naam: str | None = Field(default=None, max_length=100)
    wijk_naam: str | None = Field(default=None, max_length=200)
```

### FavoriteResponse schema

```python
class FavoriteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parcel_id: str
    user_id: uuid.UUID
    gemeente_code: str | None
    gemeente_naam: str | None
    wijk_naam: str | None
    pipeline_stage: str
    created_at: datetime
    updated_at: datetime
```

### PortfolioGroupResponse schema

```python
class PortfolioWijkGroup(BaseModel):
    wijk_naam: str | None
    parcel_count: int

class PortfolioGemeenteGroup(BaseModel):
    gemeente_code: str | None
    gemeente_naam: str | None
    total_count: int
    wijken: list[PortfolioWijkGroup]

class PortfolioResponse(BaseModel):
    gemeenten: list[PortfolioGemeenteGroup]
    total_favorites: int
```

The backend aggregates gemeente+wijk in one query. The frontend handles the provincie level from gemeente_code using CBS GeoJSON (already implemented in ProjectList.tsx).

### POST /api/parcels/favorites (create)

```python
@router.post("/favorites", response_model=FavoriteResponse, status_code=201)
async def add_favorite(request: Request, body: FavoriteCreate, ...):
    # Check for existing (idempotent)
    existing = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.organization_id == organization_id,
            ParcelFavorite.user_id == current_user.id,
            ParcelFavorite.parcel_id == body.parcel_id,
        )
    )
    fav = existing.scalar_one_or_none()
    if fav:
        return FavoriteResponse.model_validate(fav)

    fav = ParcelFavorite(
        organization_id=organization_id,
        user_id=current_user.id,
        parcel_id=body.parcel_id,
        gemeente_code=body.gemeente_code,
        gemeente_naam=body.gemeente_naam,
        wijk_naam=body.wijk_naam,
        pipeline_stage="Gesignaleerd",
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)
    return FavoriteResponse.model_validate(fav)
```

### PATCH /api/parcels/favorites/{parcel_id}/pipeline (stage update)

```python
@router.patch("/favorites/{parcel_id}/pipeline", response_model=FavoriteResponse)
async def update_pipeline_stage(
    parcel_id: str,
    body: PipelineUpdateRequest,  # Pydantic Literal["Gesignaleerd",...]
    ...
):
    fav = await _get_favorite_or_404(db, organization_id, current_user.id, parcel_id)
    fav.pipeline_stage = body.stage
    await db.commit()
    await db.refresh(fav)
    return FavoriteResponse.model_validate(fav)
```

### GET /api/portfolio (grouped view)

```python
@portfolio_router.get("", response_model=PortfolioResponse)
async def get_portfolio(...):
    # Single query, no N+1
    rows = (await db.execute(
        select(
            ParcelFavorite.gemeente_code,
            ParcelFavorite.gemeente_naam,
            ParcelFavorite.wijk_naam,
            func.count(ParcelFavorite.id).label("parcel_count"),
        )
        .where(ParcelFavorite.organization_id == organization_id)
        .group_by(
            ParcelFavorite.gemeente_code,
            ParcelFavorite.gemeente_naam,
            ParcelFavorite.wijk_naam,
        )
        .order_by(ParcelFavorite.gemeente_naam, ParcelFavorite.wijk_naam)
    )).all()

    # Aggregate into gemeente → wijken structure in Python
    gemeente_map: dict[str, PortfolioGemeenteGroup] = {}
    for gemeente_code, gemeente_naam, wijk_naam, count in rows:
        key = gemeente_code or "onbekend"
        if key not in gemeente_map:
            gemeente_map[key] = PortfolioGemeenteGroup(
                gemeente_code=gemeente_code,
                gemeente_naam=gemeente_naam,
                total_count=0,
                wijken=[],
            )
        gemeente_map[key].wijken.append(PortfolioWijkGroup(wijk_naam=wijk_naam, parcel_count=count))
        gemeente_map[key].total_count += count

    total = sum(g.total_count for g in gemeente_map.values())
    return PortfolioResponse(gemeenten=list(gemeente_map.values()), total_favorites=total)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| python-jose JWT | PyJWT with explicit `algorithms=["HS256"]` | MEMORY.md | Don't use jose |
| passlib/bcrypt | pwdlib + Argon2id | MEMORY.md | Don't use passlib |
| async with db.begin() | db.add()/db.commit() directly | MEMORY.md | Never nest transactions |
| datetime.now(timezone.utc) | datetime.utcnow() | MEMORY.md | Naive UTC for TIMESTAMP WITHOUT TZ |

## Open Questions

1. **Idempotent POST vs 409 on duplicate favorite**
   - What we know: UniqueConstraint on (org_id, user_id, parcel_id) prevents duplicates at DB level
   - What's unclear: Phase 110 will use optimistic UI — the frontend may POST before checking existing state on re-open
   - Recommendation: Implement GET-or-create (return existing + 200) for Phase 109 to support Phase 110's optimistic pattern. Document clearly.

2. **DELETE by parcel_id vs by favorite UUID**
   - What we know: Success criterion says `DELETE /api/parcels/favorites/{parcel_id}` — by Kadaster string, not UUID
   - What's unclear: If a user has multiple favorites for the same parcel across orgs, this is fine since we also filter by user_id + org_id
   - Recommendation: Delete by (org_id, user_id, parcel_id) triple — unambiguous.

3. **Scope of GET /api/parcels/favorites — user-scoped vs org-scoped**
   - What we know: BACK-01 includes both `org_id` AND `user_id` in the model
   - What's unclear: Should GET return only the current user's favorites, or all org favorites?
   - Recommendation: Return current user's favorites only (user_id filter). Org-wide aggregation is served by `/api/portfolio`. This matches the multi-user scenario.

## Sources

### Primary (HIGH confidence)

- Codebase: `backend/app/models/parcel_document.py` — direct model pattern reference
- Codebase: `backend/app/documents/router.py` — CRUD router pattern reference
- Codebase: `backend/app/projects/router.py` — grouped query + PATCH pattern reference
- Codebase: `backend/alembic/versions/3882c5c83b07_create_parcel_documents_table.py` — migration + RLS pattern
- Codebase: `backend/app/models/base.py` — TenantMixin + TimestampMixin
- Codebase: `backend/app/main.py` — router registration pattern
- `.planning/MEMORY.md` — critical project-wide patterns (transactions, datetimes)
- `.planning/REQUIREMENTS.md` — BACK-01 through BACK-04 definitions
- `.planning/ROADMAP.md` — Phase 109 success criteria + plan breakdown

### Secondary (MEDIUM confidence)

- Codebase: `frontend/src/components/projects/ProjectList.tsx` — confirmed provincie-to-gemeente mapping is frontend-only (CBS GeoJSON)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BACK-01 | ParcelFavorite model (org_id, user_id, parcel_id as Kadaster string, wijk_code, gemeente_code, pipeline_stage, created_at) | Model pattern section + code example; `wijk_code` in requirements → implement as `wijk_naam` (consistent with codebase — no wijk_code exists anywhere) |
| BACK-02 | Favorites CRUD API endpoints (POST/GET/DELETE) with multi-tenant isolation | Router pattern section + POST/DELETE code examples; GET uses org_id + user_id filter |
| BACK-03 | Pipeline stage update endpoint (PATCH) | PATCH code example; Pydantic Literal for validation → 422 response |
| BACK-04 | Bulk portfolio endpoint: list all favorites grouped by gemeente/wijk with counts in a single query (no N+1) | Single GROUP BY query + Python aggregation code example |
</phase_requirements>

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies required
- Architecture: HIGH — all patterns directly sourced from existing codebase files
- Pitfalls: HIGH — documented from MEMORY.md project-wide patterns + codebase analysis

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable FastAPI/SQLAlchemy patterns)
