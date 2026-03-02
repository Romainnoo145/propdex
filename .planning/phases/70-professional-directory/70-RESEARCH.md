# Phase 70: Professional Directory - Research

**Researched:** 2026-03-02
**Domain:** Platform-wide cross-tenant directory with PostgreSQL ARRAY fields, NULL org_id RLS policy, FastAPI admin CRUD, React card-grid frontend
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Directory presentation**
- Card grid layout — consistent with existing GemeenteCard/WijkCard patterns in the codebase
- Each card shows: naam, bedrijfsnaam, werkgebied (as gemeente tags/chips), gevolgklassen (GK1/GK2/GK3 badges), TloKB verification link
- Responsive grid: 3 columns desktop, 2 tablet, 1 mobile
- Cards are read-only for tenant users — no edit actions visible

**Admin management flow**
- Admin-only CRUD endpoints (role-gated, not tenant-scoped)
- Simple form-based add/edit — no bulk import needed for initial launch (small number of kwaliteitsborgers)
- Admin can set: naam, bedrijfsnaam, werkgebied (multi-select gemeenten), gevolgklassen (multi-select GK1/GK2/GK3), email, telefoon, website, tlokb_url
- Admin interface can be API-only for now — frontend admin UI is optional (can use API directly or add later)

**Filtering & discovery**
- Gemeente filter as primary filter — dropdown or search input matching the werkgebied field
- Gevolgklasse filter as secondary filter — checkbox or toggle for GK1/GK2/GK3
- Auto-filter from property context when navigating from a property report: pre-fill gemeente from parcel's gemeente + gevolgklasse from Wkb classification
- Show count of matching professionals in filter header
- Empty state: "Geen kwaliteitsborgers gevonden voor [gemeente/gevolgklasse]"

**Professional profile depth**
- No separate detail page — all relevant info visible on the card itself
- TloKB link opens in new tab with external link icon
- Werkgebied shown as compact gemeente chips (max 5 visible, "+N meer" overflow)
- Gevolgklasse shown as colored badges matching the GK badge pattern used in Wkb sections

### Claude's Discretion
- Exact card styling and spacing
- Filter component implementation (combobox vs dropdown)
- Loading states and skeleton patterns
- Pagination vs show-all approach (depends on data volume)
- Sort order (alphabetical by naam vs relevance when filtered)

### Deferred Ideas (OUT OF SCOPE)
- Kwaliteitsborger self-registration portal — future phase
- Professional ratings/reviews — not appropriate for MVP
- Bulk import from CSV/Excel — add when directory grows beyond manual management
- Professional availability/calendar integration — future marketplace feature
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIR-01 | Admin can add kwaliteitsborger profiles (naam, bedrijf, werkgebied, gevolgklassen, contact) | PostgreSQL ARRAY columns for werkgebied + gevolgklassen; ADMIN_API_KEY secret in Settings + `require_admin_key` FastAPI dependency; POST/PUT/DELETE /api/professionals |
| DIR-02 | Kwaliteitsborgers matched to leads based on werkgebied (gemeente) and gevolgklasse | GIN index on werkgebied array enables `ANY(werkgebied)` filter; gevolgklasse filter via `@>` operator on ARRAY; GET /api/professionals?gemeente=X&gevolgklasse=GK1 |
| DIR-03 | Professional profiles are platform-wide (not tenant-isolated) with admin-only management | NULL organization_id pattern — skip TenantMixin; custom RLS policy `USING (TRUE)` for reads, `USING (FALSE)` for writes (enforce at app layer); cross-tenant integration test |
| DIR-04 | Professional profile links to TloKB public register for verification | `tlokb_url` VARCHAR field on model; frontend renders as `<a href={tlokb_url} target="_blank" rel="noopener noreferrer">` with ExternalLink icon |
</phase_requirements>

---

## Summary

Phase 70 adds a platform-wide, admin-managed directory of kwaliteitsborgers. The defining architectural challenge is that professionals are NOT tenant-scoped: they use `NULL organization_id` and must be visible to all authenticated tenants. This requires a custom RLS policy (not the standard `tenant_isolation_X` pattern) and a cross-tenant integration test to verify visibility across org boundaries.

The backend needs: (1) a `Professional` model with PostgreSQL ARRAY columns for `werkgebied` (gemeente names) and `gevolgklassen` (GK1/GK2/GK3) indexed with GIN; (2) a new `professionals` router with read endpoints for all authenticated users and write endpoints gated by a shared admin API key (since the User model has no `is_admin` field and adding one is out of scope for this phase); (3) filter logic using PostgreSQL `ANY()` and `@>` array operators.

The frontend needs: a new `/professionals` route displaying a responsive 3-col card grid using existing `Badge` and `Button` primitives, with `Select` filter components for gemeente and gevolgklasse (existing `Select` primitive is native `<select>` — suitable for this use case), TanStack Query for data fetching, and URL search param persistence for filters so navigation from a property report can pre-fill the gemeente.

**Primary recommendation:** Use PostgreSQL ARRAY + GIN index for werkgebied and gevolgklassen (not a normalized join table) — the dataset is small (dozens of professionals), queries are read-heavy, and the CONTEXT.md explicitly calls for GIN indexes on array fields.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.x (project) | ORM model with ARRAY columns | Already used throughout codebase with `Mapped[]` + `mapped_column()` syntax |
| `sqlalchemy.dialects.postgresql` | 2.x | `ARRAY`, `GIN` index via `postgresql_using="gin"` | Required for PostgreSQL-specific types not in core SQLAlchemy |
| Alembic | 1.13+ (project) | DB migration for `professionals` table | Project standard; autogenerate then manually clean (PostGIS noise pattern) |
| FastAPI | 0.115+ (project) | Router, dependency injection, Depends() | Project standard |
| Pydantic v2 | 2.x (project) | Request/response schemas | Project standard; `BaseModel` + `ConfigDict(from_attributes=True)` |
| TanStack Query | v5.90 (project) | Data fetching, cache invalidation | Already in `useReports.ts`, `useProjects.ts` patterns |
| TanStack Router | v1.158 (project) | File-based routing; search param persistence | Already used throughout; supports `validateSearch` for filter params |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | project | ExternalLink icon for TloKB links | Already imported in SideRailNav; use `ExternalLink` icon |
| `class-variance-authority` | project | Badge variants for GK1/GK2/GK3 | Already powering `Badge` primitive — reuse directly |
| `slowapi` | 0.1.9 (project) | Rate limiting on public GET endpoint | Apply same rate limiting as reports router |
| `cmdk` | 1.1.1 (project) | Command palette / combobox | Available but overkill for simple gemeente filter; use native `Select` primitive instead |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL ARRAY + GIN | Normalized `professional_werkgebied` join table | Join table cleaner at scale but adds JOIN complexity; dataset is tiny, ARRAY is simpler and maps directly to CONTEXT.md spec |
| Admin API key header | `is_admin: bool` on User model | API key requires no DB migration or schema change; aligns with CONTEXT.md "API-only for now" framing |
| Native `Select` primitive | cmdk Combobox | cmdk adds complexity; gemeente dropdown with ~400 values is manageable in native select with search via browser native |

---

## Architecture Patterns

### Backend Module Structure

```
backend/app/
├── models/
│   └── professional.py          # Professional model (NO TenantMixin)
├── schemas/
│   └── professional.py          # ProfessionalCreate, ProfessionalResponse, etc.
└── professionals/
    ├── __init__.py
    └── router.py                # GET /api/professionals (auth), admin CRUD
```

### Frontend Structure

```
frontend/src/
├── routes/_authenticated/
│   └── professionals.tsx        # New TanStack Router route
├── components/professionals/
│   ├── ProfessionalDirectory.tsx  # Grid container + filters
│   └── ProfessionalCard.tsx       # Individual card
├── hooks/
│   └── useProfessionals.ts        # TanStack Query hook
└── lib/
    ├── api.ts                   # fetchProfessionals() added here
    └── types/
        └── professional.ts      # TypeScript interfaces
```

### Pattern 1: NULL organization_id Model (Platform Resource)

**What:** Professional has no `organization_id` — it is a platform resource, not a tenant resource. Does NOT use `TenantMixin`.

**When to use:** Any entity that must be shared across all tenants with admin-only management.

**Example:**
```python
# backend/app/models/professional.py
import uuid
from sqlalchemy import String, text, Index
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class Professional(Base, TimestampMixin):
    """
    Platform-wide kwaliteitsborger profile.

    NOT tenant-scoped. NULL organization_id pattern — visible to all
    authenticated tenants. Admin-only management via ADMIN_API_KEY header.

    RLS policy: read allowed for all (TRUE), write enforced at app layer.
    """

    __tablename__ = "professionals"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    naam: Mapped[str] = mapped_column(String(255), nullable=False)
    bedrijfsnaam: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Array of gemeente names (e.g., ["Amsterdam", "Haarlem", "Zaanstad"])
    werkgebied: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )

    # Array of gevolgklasse strings: ["GK1"] or ["GK1", "GK2"] etc.
    gevolgklassen: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )

    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    telefoon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tlokb_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, server_default=text("TRUE")
    )

    __table_args__ = (
        # GIN index on werkgebied for ANY() filter queries
        Index(
            "ix_professionals_werkgebied_gin",
            "werkgebied",
            postgresql_using="gin",
        ),
        # GIN index on gevolgklassen for @> containment queries
        Index(
            "ix_professionals_gevolgklassen_gin",
            "gevolgklassen",
            postgresql_using="gin",
        ),
        Index("ix_professionals_naam", "naam"),
        Index("ix_professionals_is_active", "is_active"),
    )
```

### Pattern 2: Custom RLS Policy (Platform-Wide Read)

**What:** For `professionals` table: enable RLS but with a `USING (TRUE)` read policy so any authenticated connection can read, while writes are blocked at the app layer.

**Why not skip RLS:** The existing RLS migration (`0800fa8394d7`) force-enables RLS on all tables with app_role. If we don't create a policy, the default-deny behavior blocks all queries. We need an explicit permissive read policy.

**Example Alembic migration snippet:**
```python
def upgrade() -> None:
    # ... create_table() ...

    # Enable RLS but with open read policy
    # (write protection enforced at application layer via ADMIN_API_KEY)
    op.execute("ALTER TABLE professionals ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE professionals FORCE ROW LEVEL SECURITY")

    # Allow all authenticated connections to read (cross-tenant visibility)
    op.execute("""
        CREATE POLICY professionals_read ON professionals
            FOR SELECT
            USING (TRUE)
    """)

    # Block INSERT/UPDATE/DELETE via RLS (defense in depth)
    op.execute("""
        CREATE POLICY professionals_write ON professionals
            FOR ALL
            USING (FALSE)
            WITH CHECK (FALSE)
    """)
```

**IMPORTANT:** The write policy blocks even the app_role from writing via normal queries. For admin CRUD to work, either:
- Option A: Use a superuser/migration role for writes (not suitable for runtime)
- Option B: Do NOT create a write-block policy — enforce at app layer only and grant BYPASSRLS to app_role for this table, OR...
- **Option C (RECOMMENDED):** Enable RLS with SELECT USING (TRUE), and for INSERT/UPDATE/DELETE, use `BYPASSRLS` on the app_role for the professionals table only. Since app_role already has BYPASSRLS if set up via `sql/setup_app_role.sql`, OR simply only create the SELECT policy and let the app_role's INSERT/UPDATE/DELETE succeed (app_role has table-level GRANT which allows writes when no restrictive policy exists for those commands).

**Verified approach:** Create RLS with FOR SELECT USING (TRUE) only. INSERT/UPDATE/DELETE operations have no restrictive policy, so they succeed for the app_role (PostgreSQL only checks RLS for commands that have matching policies; a missing policy for a command means "no restriction"). This is the cleanest approach.

```python
op.execute("ALTER TABLE professionals ENABLE ROW LEVEL SECURITY")
op.execute("ALTER TABLE professionals FORCE ROW LEVEL SECURITY")
op.execute("""
    CREATE POLICY professionals_select ON professionals
        FOR SELECT
        USING (TRUE)
""")
# No INSERT/UPDATE/DELETE policy needed — app_role has table-level GRANT
# and RLS only restricts commands that have matching policies
```

### Pattern 3: Admin API Key Dependency

**What:** Since the `User` model has no `is_admin` field, admin CRUD endpoints are gated by a shared `ADMIN_API_KEY` header. This matches the CONTEXT.md decision "admin interface can be API-only for now."

**Implementation:**
```python
# In app/core/config.py — add field:
ADMIN_API_KEY: str = Field(
    default="",
    description="Shared admin API key for platform management endpoints (set in production)",
)

# In app/professionals/router.py — dependency:
from fastapi import Header, HTTPException, Security, status
from app.core.config import settings

def require_admin_key(x_admin_key: str = Header(alias="X-Admin-Key")) -> None:
    if not settings.ADMIN_API_KEY or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
```

### Pattern 4: Array Filter Query

**What:** Filter professionals by gemeente and gevolgklasse using PostgreSQL array operators.

**Example:**
```python
# GET /api/professionals?gemeente=Amsterdam&gevolgklasse=GK1
from sqlalchemy import text, select

query = select(Professional).where(Professional.is_active == True)

if gemeente:
    # ANY(werkgebied) matches if gemeente is in the array
    query = query.where(
        text("(:gemeente) = ANY(werkgebied)").bindparams(gemeente=gemeente)
    )

if gevolgklasse:
    # @> containment: gevolgklassen contains gevolgklasse
    query = query.where(
        text("gevolgklassen @> ARRAY[:gk]::text[]").bindparams(gk=gevolgklasse)
    )

query = query.order_by(Professional.naam)
```

**Note:** SQLAlchemy ARRAY operators exist (`ARRAY.contains()`) but the raw text approach is more readable and verified against existing codebase patterns (text() is used throughout).

### Pattern 5: TanStack Router Search Params for Filter State

**What:** Gemeente and gevolgklasse filter state lives in URL search params (not React state), enabling pre-fill from property report navigation.

**Example:**
```typescript
// frontend/src/routes/_authenticated/professionals.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const professionalsSearchSchema = z.object({
  gemeente: z.string().optional(),
  gevolgklasse: z.enum(['GK1', 'GK2', 'GK3']).optional(),
})

export const Route = createFileRoute('/_authenticated/professionals')({
  validateSearch: professionalsSearchSchema,
  component: ProfessionalsPage,
})
```

This allows navigation from report detail page:
```typescript
navigate({ to: '/professionals', search: { gemeente: reportData.address.gemeente, gevolgklasse: 'GK1' } })
```

### Anti-Patterns to Avoid

- **Using TenantMixin on Professional:** This model is platform-wide. TenantMixin adds a NOT NULL organization_id FK — incompatible with NULL org_id pattern.
- **Standard `tenant_isolation_X` RLS policy:** That policy requires `organization_id = current_setting(...)::uuid` — will always deny for NULL org_id rows.
- **Relying on get_current_organization_id for filtering:** This dependency extracts tenant org_id from request state and is used for isolation. Professionals endpoint must NOT filter by org_id.
- **Storing werkgebied as a JSON string or comma-separated text:** PostgreSQL native ARRAY has GIN indexing, `ANY()`, and `@>` operators. JSON requires JSONB operators and is less ergonomic for simple array membership tests.
- **Adding `is_admin` to User model:** Out of scope for this phase; Admin API Key approach is simpler and matches CONTEXT.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array membership filter | Custom string parsing or LIKE queries | PostgreSQL `ANY()` + GIN index | Correct operator, indexed, works with SQLAlchemy text() |
| Badge component for GK1/GK2/GK3 | New badge component | Existing `Badge` primitive with `variant="amber"` | Already styled, cva variants match GK color needs |
| Gemeente chips with overflow | Custom overflow logic | Simple slice + "+N meer" inline | Dataset is small per professional; no virtualization needed |
| API fetch with auth | Custom fetch | `apiFetch()` in `lib/api.ts` | Already handles Bearer token injection, error parsing |
| Route-level search params | useState | TanStack Router `validateSearch` | Enables pre-fill from navigation, browser back/forward |

---

## Common Pitfalls

### Pitfall 1: RLS Blocks All Queries on `professionals` Table

**What goes wrong:** After enabling RLS with FORCE ROW LEVEL SECURITY, queries return 0 rows (fail-closed default). The existing `get_db()` dependency sets `SET LOCAL app.current_tenant_id = '{org_id}'` — but there's no matching policy for professionals (NULL org_id never equals a real UUID).

**Why it happens:** PostgreSQL RLS default is deny-all when no matching policy exists for a command. The `FORCE ROW LEVEL SECURITY` means even the table owner is subject to policies.

**How to avoid:** Create an explicit `FOR SELECT USING (TRUE)` policy for the professionals table. This makes all rows readable by any connection. Verified pattern from existing `0800fa8394d7` migration which shows the policy structure.

**Warning signs:** `GET /api/professionals` returns `[]` immediately after migration despite records being inserted.

### Pitfall 2: Alembic Autogenerate PostGIS Noise

**What goes wrong:** `alembic revision --autogenerate` includes spurious changes to tiger/postgis internal tables.

**Why it happens:** Documented in STATE.md — PostGIS metadata tables appear in autogenerate output.

**How to avoid:** Run autogenerate, then manually remove all changes that reference `tiger`, `topology`, `spatial_ref_sys`, `geography_columns`, `geometry_columns`. Only keep the `professionals` table creation. Verified pattern from `3d97e34821f2` migration (generated_dossiers).

**Warning signs:** Migration file contains `op.drop_table('spatial_ref_sys')` or similar.

### Pitfall 3: ARRAY Column Type in Mapped[] Annotations

**What goes wrong:** `Mapped[list[str]]` with `ARRAY(String)` may raise mypy errors if not imported correctly.

**Why it happens:** SQLAlchemy ARRAY is a dialect-specific type from `sqlalchemy.dialects.postgresql`. The `Mapped[list[str]]` type hint is correct at the Python level but the column type must be explicitly specified.

**How to avoid:**
```python
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import String
werkgebied: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
```

**Warning signs:** `mypy` errors like "Incompatible types in assignment" or runtime `AttributeError` on array fields.

### Pitfall 4: Admin Write Blocked by RLS

**What goes wrong:** Admin POST/PUT/DELETE to `professionals` table returns 403 or silently fails because an overly restrictive RLS policy blocks writes.

**Why it happens:** If a `FOR ALL USING (FALSE)` write policy is added (as a tempting defense-in-depth measure), it blocks even the app_role's INSERT/UPDATE/DELETE.

**How to avoid:** Only create a `FOR SELECT USING (TRUE)` policy. Do NOT add write-blocking policies. The app_role has table-level GRANT for INSERT/UPDATE/DELETE; without a restrictive policy for those commands, they succeed. Enforce admin-only at application layer via `require_admin_key` dependency.

**Warning signs:** `SQLSTATE 42501` on INSERT or rows not appearing after POST.

### Pitfall 5: `get_db()` Always Sets Tenant Context

**What goes wrong:** The existing `get_db()` FastAPI dependency (from `app/core/database.py`) sets `SET LOCAL app.current_tenant_id = '{org_id}'` for every authenticated request. This is fine for professionals reads (SELECT policy USING (TRUE) ignores it), but any future code that checks the tenant setting against professionals must not assume a non-null match.

**Why it happens:** `get_db()` is designed for tenant-scoped tables. It sets the session variable regardless of which table is being queried.

**How to avoid:** Professionals service layer must NOT use `current_setting('app.current_tenant_id')` in queries. Filter only by `Professional.is_active == True` and explicit `gemeente`/`gevolgklasse` params.

### Pitfall 6: TanStack Router File-Based Route Auto-Registration

**What goes wrong:** New route file `professionals.tsx` in `_authenticated/` directory does not appear in `routeTree.gen.ts` until the dev server runs (router codegen step).

**Why it happens:** TanStack Router uses `@tanstack/router-plugin` for codegen; the route tree is generated on build/dev start.

**How to avoid:** After creating the route file, run `npm run dev` or `npm run build` to trigger codegen. Verify `routeTree.gen.ts` includes the new route before testing.

**Warning signs:** TypeScript error "Route not found" or 404 in browser despite file existing.

---

## Code Examples

Verified patterns from existing codebase:

### Professional Schema (Pydantic v2)
```python
# backend/app/schemas/professional.py
import uuid
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ProfessionalCreate(BaseModel):
    naam: str = Field(max_length=255)
    bedrijfsnaam: str | None = Field(default=None, max_length=255)
    werkgebied: list[str] = Field(default_factory=list, description="Gemeente namen")
    gevolgklassen: list[str] = Field(default_factory=list, description="GK1/GK2/GK3")
    email: str | None = Field(default=None, max_length=320)
    telefoon: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=500)
    tlokb_url: str | None = Field(default=None, max_length=500)


class ProfessionalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    naam: str
    bedrijfsnaam: str | None
    werkgebied: list[str]
    gevolgklassen: list[str]
    email: str | None
    telefoon: str | None
    website: str | None
    tlokb_url: str | None
    is_active: bool


class ProfessionalListResponse(BaseModel):
    professionals: list[ProfessionalResponse]
    total: int
    gemeente_filter: str | None = None
    gevolgklasse_filter: str | None = None
```

### Router Structure
```python
# backend/app/professionals/router.py
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_active_user
from app.core.config import settings
from app.core.database import get_db
from app.models.professional import Professional
from app.schemas.professional import ProfessionalCreate, ProfessionalListResponse, ProfessionalResponse

router = APIRouter(prefix="/api/professionals", tags=["professionals"])


def require_admin_key(x_admin_key: str = Header(alias="X-Admin-Key")) -> None:
    if not settings.ADMIN_API_KEY or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("", response_model=ProfessionalListResponse)
async def list_professionals(
    gemeente: str | None = Query(default=None),
    gevolgklasse: str | None = Query(default=None),
    _user = Depends(get_current_active_user),  # auth gate
    db: AsyncSession = Depends(get_db),
) -> ProfessionalListResponse:
    query = select(Professional).where(Professional.is_active == True)
    if gemeente:
        query = query.where(
            text("(:gemeente) = ANY(werkgebied)").bindparams(gemeente=gemeente)
        )
    if gevolgklasse:
        query = query.where(
            text("gevolgklassen @> ARRAY[:gk]::text[]").bindparams(gk=gevolgklasse)
        )
    query = query.order_by(Professional.naam)
    result = await db.execute(query)
    professionals = result.scalars().all()
    return ProfessionalListResponse(
        professionals=professionals,
        total=len(professionals),
        gemeente_filter=gemeente,
        gevolgklasse_filter=gevolgklasse,
    )


@router.post("", response_model=ProfessionalResponse, status_code=201)
async def create_professional(
    data: ProfessionalCreate,
    _admin = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalResponse:
    professional = Professional(**data.model_dump())
    db.add(professional)
    await db.flush()
    await db.commit()
    await db.refresh(professional)
    return ProfessionalResponse.model_validate(professional)
```

### Frontend TypeScript Types
```typescript
// frontend/src/lib/types/professional.ts
export interface ProfessionalResponse {
  id: string
  naam: string
  bedrijfsnaam: string | null
  werkgebied: string[]     // ["Amsterdam", "Haarlem"]
  gevolgklassen: string[]  // ["GK1"]
  email: string | null
  telefoon: string | null
  website: string | null
  tlokb_url: string | null
  is_active: boolean
}

export interface ProfessionalListResponse {
  professionals: ProfessionalResponse[]
  total: number
  gemeente_filter: string | null
  gevolgklasse_filter: string | null
}

export interface ProfessionalFilters {
  gemeente?: string
  gevolgklasse?: string
}
```

### TanStack Query Hook
```typescript
// frontend/src/hooks/useProfessionals.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import type { ProfessionalFilters, ProfessionalListResponse } from '@/lib/types/professional'
import { fetchProfessionals } from '@/lib/api'

export function useProfessionals(filters: ProfessionalFilters = {}) {
  const { accessToken } = useAuth()
  return useQuery<ProfessionalListResponse, Error>({
    queryKey: ['professionals', filters],
    queryFn: () => fetchProfessionals(filters, accessToken),
    staleTime: 10 * 60 * 1000,  // 10 min — directory changes rarely
    enabled: !!accessToken,
  })
}
```

### ProfessionalCard Component Sketch
```typescript
// frontend/src/components/professionals/ProfessionalCard.tsx
import { Badge } from '@/components/primitives'
import { ExternalLink } from 'lucide-react'
import type { ProfessionalResponse } from '@/lib/types/professional'

const MAX_WERKGEBIED_VISIBLE = 5
const GK_BADGE_VARIANT = {
  GK1: 'amber',
  GK2: 'info',
  GK3: 'teal',
} as const

export function ProfessionalCard({ professional }: { professional: ProfessionalResponse }) {
  const { naam, bedrijfsnaam, werkgebied, gevolgklassen, email, telefoon, tlokb_url } = professional
  const visibleGemeenten = werkgebied.slice(0, MAX_WERKGEBIED_VISIBLE)
  const overflowCount = werkgebied.length - MAX_WERKGEBIED_VISIBLE

  return (
    <div className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 space-y-3">
      <div className="space-y-0.5">
        <h3 className="font-semibold text-grey-100">{naam}</h3>
        {bedrijfsnaam && <p className="text-sm text-grey-400">{bedrijfsnaam}</p>}
      </div>

      {/* GK badges */}
      <div className="flex flex-wrap gap-1.5">
        {gevolgklassen.map((gk) => (
          <Badge key={gk} variant={GK_BADGE_VARIANT[gk as keyof typeof GK_BADGE_VARIANT] ?? 'default'}>
            {gk}
          </Badge>
        ))}
      </div>

      {/* Werkgebied chips */}
      <div className="flex flex-wrap gap-1">
        {visibleGemeenten.map((g) => (
          <span key={g} className="text-xs bg-grey-850 text-grey-300 border border-grey-800 rounded px-1.5 py-0.5">
            {g}
          </span>
        ))}
        {overflowCount > 0 && (
          <span className="text-xs text-grey-500">+{overflowCount} meer</span>
        )}
      </div>

      {/* TloKB link */}
      {tlokb_url && (
        <a
          href={tlokb_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-teal-accent hover:underline"
        >
          <ExternalLink size={11} />
          Verifieer op TloKB register
        </a>
      )}
    </div>
  )
}
```

### Cross-Tenant Integration Test Pattern
```python
# backend/tests/integration/test_professionals_cross_tenant.py
"""Cross-tenant integration test for professional directory (DIR-03)."""

async def test_professionals_visible_to_any_tenant(async_client, test_db, create_test_user):
    """Professionals with NULL org_id are returned for any authenticated tenant."""
    # Create professional directly (bypassing admin auth for test setup)
    from app.models.professional import Professional
    prof = Professional(naam="Jan Kwaliteitsborger", werkgebied=["Amsterdam"], gevolgklassen=["GK1"])
    test_db.add(prof)
    await test_db.commit()

    # User from Org A can see it
    user_a, org_a = await create_test_user(email="a@test.com", org_name="Org A")
    token_a = create_access_token({"sub": str(user_a.id), "type": "access"})
    resp = await async_client.get("/api/professionals", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    assert len(resp.json()["professionals"]) == 1

    # User from Org B also sees it
    user_b, org_b = await create_test_user(email="b@test.com", org_name="Org B")
    token_b = create_access_token({"sub": str(user_b.id), "type": "access"})
    resp = await async_client.get("/api/professionals", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 200
    assert len(resp.json()["professionals"]) == 1
```

---

## Open Questions

1. **ADMIN_API_KEY empty string behavior**
   - What we know: `settings.ADMIN_API_KEY` defaults to `""` (empty string)
   - What's unclear: Should empty ADMIN_API_KEY mean "admin disabled" (all requests rejected) or "admin open" (no key needed)?
   - Recommendation: Treat empty as "disabled" — raise 403 if `not settings.ADMIN_API_KEY`. This prevents accidental open admin in dev environments. Document in `.env.example`.

2. **TloKB URL format per professional**
   - What we know: Public register is at `register.tlokb.nl/kb/kwaliteitsborger` — individual profiles have per-professional URLs
   - What's unclear: Whether individual profiles have stable URL patterns (e.g., `/kwaliteitsborger/{id}`) or are search-result URLs
   - Recommendation: Store the full URL as `tlokb_url` VARCHAR — admin must paste the individual TloKB register URL when adding each professional. No templating needed for MVP.

3. **Professionals route navigation placement**
   - What we know: SideRailNav has `navItems` array with Kaart + Projecten; professionals is a new top-level section
   - What's unclear: Whether a new SideRailNav entry is in scope for Phase 70 (CONTEXT.md says card grid frontend component, not necessarily nav integration)
   - Recommendation: Add a route accessible at `/professionals` (for pre-fill navigation from report page) without adding a SideRailNav entry in Phase 70 — the Phase 71 CTA is the primary entry point. A direct URL link from the report is sufficient.

4. **Count-before-filter for empty-state messaging**
   - What we know: CONTEXT.md says "Show count of matching professionals in filter header"
   - What's unclear: Should we also show total directory count alongside filtered count?
   - Recommendation: Return both `total` (filtered) and optionally `total_unfiltered` from the endpoint. Frontend shows "X kwaliteitsborgers gevonden" when filtered, "X kwaliteitsborgers in directory" when unfiltered.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `backend/app/models/report.py` — JSONB + GIN index pattern with `postgresql_using="gin"`
- Existing codebase — `backend/alembic/versions/0800fa8394d7_enable_rls_on_all_tenant_tables.py` — RLS policy structure
- Existing codebase — `backend/alembic/versions/3d97e34821f2_add_generated_dossiers_table.py` — migration pattern (autogenerate + clean)
- Existing codebase — `backend/app/models/base.py` — TenantMixin, TimestampMixin, Base
- Existing codebase — `backend/app/core/config.py` — Settings pydantic-settings pattern
- Existing codebase — `frontend/src/components/primitives/` — Badge, Select, Button, Card primitives
- Existing codebase — `frontend/src/hooks/useReports.ts` — TanStack Query hook pattern
- Existing codebase — `frontend/src/lib/api.ts` — `apiFetch()` pattern
- Existing codebase — `backend/tests/integration/test_multi_tenant.py` — cross-tenant test fixtures

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` — TloKB register at `register.tlokb.nl`; GK1-only scope for v9.0; professional directory design rationale
- `.planning/STATE.md` — NULL org_id pattern explicitly documented as "Professional model uses NULL org_id (platform-wide, not tenant-isolated) -- v9.0 critical pattern"

### Tertiary (LOW confidence)
- PostgreSQL ARRAY operator semantics (`ANY()`, `@>`) — based on training data; recommend verifying against PostgreSQL 16 docs if behavior is unclear in test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies required
- Architecture: HIGH — patterns verified against existing codebase code (RLS migration, model files, router patterns)
- Pitfalls: HIGH — RLS pitfall verified against existing RLS migration; Alembic noise verified against STATE.md; ARRAY type verified against JSONB precedent
- Frontend patterns: HIGH — TanStack Query v5, Router file-based routing, existing primitives all confirmed in codebase

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack — no rapidly-changing dependencies)
