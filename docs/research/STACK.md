# Stack Research

**Domain:** PropTech portfolio management + deal pipeline (Dutch real estate)
**Researched:** 2026-03-15
**Confidence:** HIGH (all recommendations are zero-new-dependency or use already-installed packages verified from pyproject.toml + .venv)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for **v17.0 Projecten Portfolio**. Existing validated
capabilities (FastAPI, SQLAlchemy 2.x, React 19, Vite 7, MapLibre, TanStack Query v5, Framer
Motion, Jinja2, fastapi-mail, WeasyPrint) are NOT re-documented.

The five new features are:
1. Server-side parcel favorites (replacing localStorage)
2. Pipeline stage tracking per parcel
3. Email template generation and sending (brief naar eigenaar, pre-overleg gemeente)
4. Dossier completeness tracking
5. Multi-parcel project grouping

---

## Final Answer: Zero New Backend Dependencies

All five backend features are covered by the existing installed stack.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| Server-side parcel favorites | None | SQLAlchemy 2.x (new model, same pattern as `ChangeReadState`) |
| Pipeline stage tracking | None | SQLAlchemy `Enum` type (already used in codebase) |
| Email template generation | None | Jinja2 3.1.6 (already installed, used for WeasyPrint HTML templates) |
| Email sending | None | fastapi-mail 1.6.2 (already installed, same `FastMail` pattern as `auth/email.py`) |
| Dossier completeness tracking | None | Pure Python set logic over existing `ParcelDocument` rows |
| Multi-parcel project grouping | None | Nullable FK to existing `Project` model — zero new tables |

**`pyproject.toml` changes: none required.**

---

## Frontend: One Optional Addition

One frontend library is recommended for drag-to-reorder pipeline stage management if a
kanban board layout is chosen. It is deferrable if a simpler pill/dropdown stage selector
is used instead.

| Library | Version | Purpose | Condition |
|---------|---------|---------|-----------|
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | `^6.3.1` | Accessible drag-and-drop for kanban pipeline board | Only if kanban layout chosen |

**`package.json` changes: none required if linear stage selector used.**

---

## Recommended Stack (New Additions Only)

### Backend — New Models (no new packages)

| Model | Columns (key) | Pattern |
|-------|--------------|---------|
| `ParcelFavorite` | `organization_id`, `user_id`, `parcel_id`, `wijk_naam`, `gemeente_code`, `pipeline_stage`, `notes`, `project_id` | Follows `ChangeReadState` — tenant-isolated, INSERT/DELETE rows |

**Why single model:** The v17.0 spec says pipeline stage is per-favorited parcel. A separate
`PipelineStatus` table is only needed if non-favorited parcels need pipeline state, which is
not in scope.

**Why denormalize `wijk_naam` + `gemeente_code` on the row:** Portfolio navigation
(provincie → gemeente → wijk → parcel) requires geographic drill-down without joining to
`scan_results`. The geographic context stored on the favorite row avoids coupling favorites
to a specific scan that may be re-run or deleted.

**Why no FK from `ParcelFavorite` to `ScanResult`:** `scan_results` is per-org and changes
when re-scanned. A FK would break favorites when scans are updated. Match by `parcel_id`
string at query time (same pattern as `ChangeRecord.matched_parcel_id` persisted FK).

**Schema:**
```sql
parcel_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,          -- TenantMixin
  user_id UUID REFERENCES users(id),      -- per-user favorites (not org-wide)
  parcel_id VARCHAR(50) NOT NULL,         -- Kadaster identifier
  wijk_naam VARCHAR(200),                 -- denormalized for portfolio nav
  gemeente_code VARCHAR(10),              -- denormalized for province drill-down
  pipeline_stage VARCHAR(20) DEFAULT 'gesignaleerd',  -- PipelineStage enum
  notes TEXT,                             -- free-form user notes
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- optional deal grouping
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id, parcel_id)
)
```

### Backend — New Constants File

| File | Content |
|------|---------|
| `app/projects/constants.py` | `PipelineStage` enum + `DOSSIER_SCHEMA` dict |

```python
# app/projects/constants.py

from enum import Enum

class PipelineStage(str, Enum):
    GESIGNALEERD = "gesignaleerd"
    ONDERZOEK = "onderzoek"
    CONTACT = "contact"
    BESLUIT = "besluit"
    AFGEROND = "afgerond"

# Expected document types per dossier category.
# Completeness = uploaded_types ∩ expected_types / |expected_types|
DOSSIER_SCHEMA: dict[str, list[str]] = {
    "acquisitie": [
        "kadaster_uittreksel",
        "eigendomsbewijs",
        "koopovereenkomst",
    ],
    "technisch": [
        "bodemonderzoek",
        "funderingsrapport",
        "asbestinventarisatie",
    ],
    "planologisch": [
        "bestemmingsplan",
        "omgevingsvergunning",
        "vooroverleg_gemeente",
    ],
    "juridisch": [
        "akte_van_levering",
        "erfpacht_akte",
        "kwalitatieve_verplichting",
    ],
    "notities": [],  # free-form, no completeness tracking
}
```

### Backend — New Jinja2 Templates

| File | Purpose |
|------|---------|
| `app/projects/templates/brief_eigenaar.jinja2` | Dutch owner outreach letter |
| `app/projects/templates/pre_overleg_gemeente.jinja2` | Pre-consultation municipality letter |

**Template variables for `brief_eigenaar.jinja2`:**
`parcel_adres`, `perceel_id`, `eigenaar_naam` (user-provided — never auto-populated from BRK),
`projectnaam`, `organisatie_naam`, `datum`, `gebruiker_naam`, `contactgegevens`

**Template variables for `pre_overleg_gemeente.jinja2`:**
`gemeente_naam`, `parcel_adres`, `bestemming_naam`, `bouwplan_omschrijving`,
`datum`, `organisatie_naam`, `contactgegevens`

**Rendering pattern** (identical to WeasyPrint HTML templates):
```python
from jinja2 import Environment, PackageLoader

env = Environment(loader=PackageLoader("app", "projects/templates"))
template = env.get_template("brief_eigenaar.jinja2")
rendered = template.render(**variables)
```

**Sending pattern** (identical to `auth/email.py`):
```python
from app.auth.email import fm  # reuse existing FastMail instance
from fastapi_mail import MessageSchema, MessageType

message = MessageSchema(
    subject=f"Brief: {parcel_adres}",
    recipients=[recipient_email],  # user must provide — AVG compliance
    body=rendered_html,
    subtype=MessageType.html,
)
await fm.send_message(message)
```

**AVG/GDPR constraint:** Recipient email address for `brief_eigenaar` MUST be entered
manually by the user. Never auto-populate from BRK eigendomsdata (personal data, Tier 3).
The template generates letter text; delivery is the user's responsibility.

### Frontend — New Route

| Route | Purpose |
|-------|---------|
| `/projecten` (existing, rebuild) | Geographic portfolio navigator — provincie → gemeente → wijk → parcel |
| `/projecten/$parcelId` (new) | Per-parcel project workspace with pipeline, dossier, outreach |

**State management:** TanStack Query for all server state (favorites list, pipeline stage,
dossier completeness). No new state manager needed. Mutations use `useMutation` +
`queryClient.invalidateQueries` — same pattern as existing parcel document upload.

**Completeness calculation:** Derive in the API response (Python set intersection), not
client-side. Return `completeness_pct: float` + `missing_types: list[str]` per category.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Unmaintained since 2022, React 18+ issues in strict mode | `@dnd-kit/core` if DnD needed; or skip entirely with pill selector |
| `redux` / `zustand` | TanStack Query manages server state; local UI state is component-scoped | TanStack Query mutations + React `useState` |
| SendGrid / Postmark | SaaS email adds cost and data-processor obligations (AVG) for outreach letters that users send manually | fastapi-mail with existing `MAIL_*` SMTP settings |
| `celery` | ARQ already provides async jobs; Celery adds broker complexity | `arq` (already installed, Redis-backed) |
| Separate file storage (S3/MinIO) | LargeBinary PostgreSQL works at current scale; Phase 106 proved the pattern | PostgreSQL `LargeBinary` (existing `ParcelDocument` pattern) |
| Elasticsearch | Portfolio search is over hundreds of favorited parcels per org max | PostgreSQL full-text search (`to_tsvector`) |
| A new `PipelineStatus` model | Pipeline state is per-favorited-parcel — adding columns to `ParcelFavorite` is sufficient | Column on `ParcelFavorite` |
| A new `DealGroup` model | The existing `Project` model already has `name`, `description`, org isolation, `gemeente_code`/`wijk_naam` context | Nullable `project_id` FK on `ParcelFavorite` pointing at existing `projects` table |
| Materialized view for completeness | Derived computation from `parcel_documents` is fast at expected scale (<1000 docs/parcel) | Python set intersection at query time |
| GraphQL | REST with TanStack Query already has clean data contracts | FastAPI REST endpoints |

---

## Dossier Completeness Pattern

**No DB changes.** The completeness percentage is computed at read time:

```python
# In the parcel workspace API endpoint
from app.projects.constants import DOSSIER_SCHEMA

uploaded = await db.execute(
    select(ParcelDocument.document_type)
    .where(ParcelDocument.organization_id == org_id)
    .where(ParcelDocument.parcel_id == parcel_id)
)
uploaded_types = {row[0] for row in uploaded.all()}

completeness = {}
for category, expected in DOSSIER_SCHEMA.items():
    if not expected:
        completeness[category] = {"pct": None, "missing": []}
        continue
    uploaded_in_cat = uploaded_types & set(expected)
    pct = len(uploaded_in_cat) / len(expected)
    missing = [t for t in expected if t not in uploaded_types]
    completeness[category] = {"pct": round(pct, 2), "missing": missing}
```

**Why compute at read time:** A stored completeness percentage goes stale when documents
are added or deleted. Computing from source (document rows) ensures accuracy. With TanStack
Query's cache, this query runs once per navigation — no performance issue at expected scale.

---

## Multi-Parcel Project Grouping Pattern

**Approach:** Add nullable `project_id UUID` FK on `ParcelFavorite` → `projects.id`.
A "deal" (multi-parcel project) is a `Project` row with `name` + optional `description`.
Parcels in the deal share the same `project_id`.

**Constraint:** One parcel per project (simplest model for v17.0). If many-to-many is
needed in a future phase, introduce a `ProjectParcel` join table.

**Migration:** Single `alembic revision --autogenerate` — one FK column, one index.

**Why reuse `Project` not a new model:** The `projects` table already has multi-tenant
isolation (`organization_id`), hierarchy support (`parent_id` self-ref), and geographic
context (`gemeente_code`, `wijk_naam`). Zero new tables. The existing `Project` endpoints
can serve deal CRUD.

---

## Installation

```bash
# Backend — zero new dependencies
# All features use: sqlalchemy, jinja2, fastapi-mail, alembic (all already installed)

# Run migration after adding ParcelFavorite model
cd backend && alembic revision --autogenerate -m "add_parcel_favorites"
alembic upgrade head

# Frontend — only if kanban pipeline board chosen (not pill selector)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `fastapi-mail` | `1.6.2` (installed) | FastAPI 0.115, Python 3.11 | Verified in existing auth flow — same `FastMail` instance reusable |
| `jinja2` | `3.1.6` (installed) | Python 3.11, WeasyPrint 68.1 | Already used for PDF report templates — identical usage |
| `SQLAlchemy Enum` | part of `>=2.0.25` | PostgreSQL 16, asyncpg 0.29 | Standard pattern — `sa.Enum(PipelineStage)` with `native_enum=False` to avoid PG enum type migrations |
| `@dnd-kit/core` | `^6.3.1` | React 19, TypeScript 5.9 | No peer dep conflicts; designed for React 17+ |

**SQLAlchemy Enum note:** Use `native_enum=False` to store as VARCHAR. PostgreSQL native
enums require a separate `CREATE TYPE` migration and cannot be easily altered — the VARCHAR
approach matches the existing codebase pattern.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Nullable `project_id` FK on `ParcelFavorite` | New `ProjectMembership` join table | Only if a parcel needs to belong to multiple projects simultaneously |
| `PipelineStage` enum column on `ParcelFavorite` | Separate `PipelineStatus` table with history | Only if stage change audit trail is required (future phase) |
| Jinja2 letter templates | Claude AI generation | AI adds 5-30s latency and per-token cost; templated letters with variable substitution are deterministic, instant, and appropriate for legal correspondence |
| Compute completeness at read time | Stored `completeness_pct` column | Only if query performance becomes an issue at >10k documents per org |
| `@dnd-kit/core` | Framer Motion `Reorder` | Framer `Reorder` handles simple list reorder but not cross-list kanban (dragging between pipeline stages); `@dnd-kit` is the current standard for accessible multi-list DnD |

---

## Sources

- `backend/pyproject.toml` — confirmed installed packages and versions (HIGH confidence — direct file read)
- `backend/.venv/lib/python3.11/site-packages/fastapi_mail-1.6.2.dist-info/METADATA` — confirmed fastapi-mail 1.6.2 installed (HIGH confidence — direct .venv inspection)
- `jinja2-3.1.6.dist-info` in `.venv` — confirmed Jinja2 3.1.6 installed (HIGH confidence)
- `app/auth/email.py` — existing FastMail pattern; `FastMail(ConnectionConfig(...))` + `MessageSchema` (HIGH confidence — direct code read)
- `app/models/change_read_state.py` — `ParcelFavorite` design follows this pattern exactly (HIGH confidence)
- `app/models/parcel_document.py` — dossier completeness builds on this model (HIGH confidence)
- `app/models/project.py` — multi-parcel grouping reuses this model (HIGH confidence)
- `frontend/package.json` — confirmed React 19, Framer Motion 12.35.2, TanStack Query 5.x installed (HIGH confidence)
- `@dnd-kit` React 19 compatibility: https://dndkit.com — peer deps specify React 17+ (MEDIUM confidence — React 19 is recent but no breaking changes in React API used by dnd-kit)

---

*Stack research for: v17.0 Projecten Portfolio — portfolio management + deal pipeline*
*Researched: 2026-03-15*
