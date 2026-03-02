# Phase 69: Risicobeoordeling Dossier - Research

**Researched:** 2026-03-02
**Domain:** PDF generation (WeasyPrint + Jinja2), FastAPI streaming endpoints, SQLAlchemy model, Alembic migration, React download flow
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOSSIER-01 | User can generate a "Risicobeoordeling Startdossier" PDF for any property | POST `/api/reports/{report_id}/dossier` endpoint → WeasyPrint → StreamingResponse; existing `export_report_pdf` pattern is direct template |
| DOSSIER-02 | Dossier includes: perceelgegevens, bouwjaar, bodemkwaliteit, bestemmingsplan, monumentstatus, energielabel, Wkb classificatie | All data in `SavedReport.report_data` JSONB; `PropertyReportResponse` schema covers all sections; Jinja2 template reads from dict |
| DOSSIER-03 | Dossier includes legal disclaimer (data is indicatief, assembled from public sources) | `@page` footer pattern with running footer element already proven in `report.html`; disclaimer `.disclaimer` CSS class already defined |
</phase_requirements>

---

## Summary

Phase 69 adds a "Risicobeoordeling Startdossier" PDF generation feature targeted at kwaliteitsborgers. The core technical challenge is creating a second PDF export endpoint and template alongside the existing general report export. WeasyPrint (`weasyprint>=68.0`) and Jinja2 (`jinja2>=3.1.0`) are already present in `pyproject.toml` — no new dependencies are needed on the backend.

The existing `app/reports/pdf_export.py` + `app/reports/router.py` (`GET /{report_id}/export/pdf`) establishes the complete pattern: a synchronous WeasyPrint generation function called via `asyncio.to_thread()`, returning a `StreamingResponse` with `application/pdf`. The new endpoint will follow this pattern exactly, but use a dedicated `wkb_kwaliteitsborger.html` Jinja2 template that focuses on the required sections and carries a mandatory per-page disclaimer.

The plan calls for a `GeneratedDossier` model (plan 69-01) to track dossier generation history (who generated, when, which report). This is a new SQLAlchemy model with `TenantMixin` + `TimestampMixin`, a new Alembic migration, and two new endpoints: `POST /api/reports/{report_id}/dossier` (generate + record) and `GET /api/reports/{report_id}/dossiers` (list history). The frontend (plan 69-03) adds a "Genereer Startdossier" CTA button in `ReportDetailPage` / `ReportHeader` following the same download-blob pattern as the existing PDF export button.

**Primary recommendation:** Reuse the exact `asyncio.to_thread(generate_*_pdf, ...)` + `StreamingResponse` pattern from the existing PDF export. Write a new `generate_dossier_pdf()` function and `wkb_kwaliteitsborger.html` template. Add a `GeneratedDossier` model for audit trail. Wire a CTA button in the frontend using `fetch()` → `response.blob()` → programmatic `<a>` download — identical to `exportReportPDF()` in `api.ts`.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| weasyprint | >=68.0 | HTML→PDF generation | Already in pyproject.toml; proven in `pdf_export.py` |
| jinja2 | >=3.1.0 | HTML template rendering | Already in pyproject.toml; used in `pdf_export.py` |
| sqlalchemy | >=2.0.25 | ORM model for GeneratedDossier | Project standard; `Mapped[type]` + `mapped_column()` syntax |
| alembic | >=1.13.0 | DB migration for new table | Project standard; migrations in `backend/alembic/versions/` |
| fastapi | >=0.115.0 | Streaming PDF response endpoint | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| asyncio.to_thread | stdlib | Run sync WeasyPrint in executor | Always — WeasyPrint is CPU-bound, must not block event loop |
| io.BytesIO | stdlib | Wrap PDF bytes for StreamingResponse | Standard pattern for streaming responses |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WeasyPrint | ReportLab, fpdf2, xhtml2pdf | WeasyPrint already installed and proven; others add no value |
| Jinja2 template | Python string concat | Jinja2 is already installed; templates are maintainable, testable |
| GeneratedDossier DB model | In-memory only (no persistence) | DB model gives download history needed for Phase 71 LEAD-04 (dossier attachment) |

**Installation:** No new packages needed — all are already in `pyproject.toml`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/reports/
├── pdf_export.py          # Existing: generate_report_pdf()
├── dossier_export.py      # NEW: generate_dossier_pdf()
├── router.py              # Extended: POST/GET dossier endpoints
├── service.py             # Extended: save_generated_dossier()
└── templates/
    ├── report.html        # Existing
    └── wkb_kwaliteitsborger.html  # NEW: dossier template

backend/app/models/
└── generated_dossier.py   # NEW: GeneratedDossier SQLAlchemy model

backend/alembic/versions/
└── XXXX_add_generated_dossiers_table.py  # NEW

frontend/src/lib/
└── api.ts                 # Extended: generateDossier(), listDossiers()

frontend/src/components/reports/
└── ReportDetailPage.tsx   # Extended: "Genereer Startdossier" CTA button
```

### Pattern 1: Dossier PDF Generation (sync function + executor)

**What:** Synchronous WeasyPrint function called from async endpoint via `asyncio.to_thread()`
**When to use:** Always for WeasyPrint — it's CPU-bound and blocks the event loop

```python
# Source: app/reports/pdf_export.py (existing pattern)
# backend/app/reports/dossier_export.py

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML


def generate_dossier_pdf(report_data: dict, report_name: str, generated_by: str) -> bytes:
    """
    Generate Risicobeoordeling Startdossier PDF for kwaliteitsborgers.

    SYNCHRONOUS — call via asyncio.to_thread() from async endpoints.

    Args:
        report_data: PropertyReportResponse dict (from SavedReport.report_data)
        report_name: Report name (address string)
        generated_by: User full name for dossier metadata

    Returns:
        PDF bytes ready for streaming
    """
    template_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template("wkb_kwaliteitsborger.html")

    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    context = {
        "report_name": report_name,
        "report_data": report_data,
        "generated_at": generated_at,
        "generated_by": generated_by,
    }

    html_string = template.render(context)
    html = HTML(string=html_string)
    return html.write_pdf()
```

### Pattern 2: Streaming PDF Endpoint

**What:** FastAPI endpoint that generates PDF and streams it to client
**When to use:** For any PDF export endpoint

```python
# Source: app/reports/router.py lines 1008-1075 (existing export_report_pdf pattern)

@router.post("/{report_id}/dossier")
@limiter.limit("5/minute")
async def generate_startdossier(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Generate Risicobeoordeling Startdossier PDF."""
    # 1. Fetch report (validates tenant + exists + not deleted)
    report = await service.get_report(
        report_id=report_id,
        organization_id=organization_id,
        session=db,
    )

    # 2. Generate PDF in executor (WeasyPrint is CPU-bound)
    pdf_bytes = await asyncio.to_thread(
        generate_dossier_pdf,
        report.report_data,
        report.report_name,
        current_user.full_name or current_user.email,
    )

    # 3. Record generation in GeneratedDossier table
    await service.save_generated_dossier(
        report_id=report_id,
        organization_id=organization_id,
        user_id=current_user.id,
        file_size=len(pdf_bytes),
        session=db,
    )

    # 4. Build filename
    postcode_clean = report.postcode.replace(" ", "")
    filename = f"risicobeoordeling-{postcode_clean}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
```

### Pattern 3: GeneratedDossier Model

**What:** SQLAlchemy model for dossier generation audit trail
**When to use:** For Phase 71 LEAD-04 where lead request must attach latest dossier

```python
# Source: app/models/report.py + app/models/base.py (established patterns)
# backend/app/models/generated_dossier.py

import uuid
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin, TimestampMixin


class GeneratedDossier(Base, TenantMixin, TimestampMixin):
    """Audit record for each Risicobeoordeling Startdossier generation.

    Stores generation metadata. PDF bytes are NOT stored (generated on demand).
    """

    __tablename__ = "generated_dossiers"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("saved_reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    generated_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="PDF size in bytes for monitoring",
    )
    template_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="v1",
        comment="Template version used (for future compatibility)",
    )

    __table_args__ = (
        Index("ix_generated_dossiers_org_report", "organization_id", "report_id"),
        Index("ix_generated_dossiers_org_created", "organization_id", "created_at"),
    )
```

### Pattern 4: WeasyPrint Template — Per-Page Disclaimer via CSS Running Elements

**What:** CSS `position: running(footer)` + `@page { @bottom-center { content: element(footer); } }` places disclaimer on every page
**When to use:** Required for DOSSIER-03 — disclaimer must appear on every page

```html
<!-- Source: app/reports/templates/report.html (existing footer pattern) -->
<!-- Adapted for mandatory disclaimer in wkb_kwaliteitsborger.html -->

<style>
    @page {
        size: A4;
        margin: 2cm 2cm 3cm 2cm;  /* extra bottom for footer */
        @bottom-center {
            content: element(footer);
        }
    }

    .page-footer {
        position: running(footer);
        font-size: 8pt;
        color: #666;
        text-align: center;
        border-top: 1px solid #ddd;
        padding-top: 0.5em;
    }

    .disclaimer-box {
        background-color: #fff8e1;
        border-left: 4px solid #e67e00;
        padding: 0.8em;
        margin: 1.5em 0;
        font-size: 9pt;
    }
</style>

<!-- Running footer — appears on EVERY page -->
<div class="page-footer">
    INDICATIEF DOCUMENT | Propdex Risicobeoordeling Startdossier |
    Gegenereerd: {{ generated_at }} | Geen formeel Wkb-nalevingsdocument
</div>
```

### Pattern 5: Frontend Download Flow

**What:** `fetch()` → `response.blob()` → programmatic anchor click → file download
**When to use:** This is the established pattern from `exportReportPDF()` in `api.ts`

```typescript
// Source: frontend/src/lib/api.ts lines 351-375 (existing exportReportPDF pattern)
// New function: generateStartdossier()

export async function generateStartdossier(
  reportId: string,
  accessToken: string | null
): Promise<Blob> {
  const headers = new Headers()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${REPORTS_BASE}/${reportId}/dossier`, {
    method: 'POST',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Dossier generation failed with status ${response.status}` }))
    throw new Error(error.detail || `Dossier generation failed with status ${response.status}`)
  }

  return response.blob()
}
```

```typescript
// Usage in ReportDetailPage / ReportHeader
const [isDossierGenerating, setIsDossierGenerating] = useState(false)

const handleGenerateDossier = useCallback(async () => {
  if (!reportId || !user?.access_token) return
  setIsDossierGenerating(true)
  try {
    const blob = await generateStartdossier(reportId, user.access_token)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `risicobeoordeling-${data.address.postcode.replace(' ', '')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Dossier generation failed:', err)
  } finally {
    setIsDossierGenerating(false)
  }
}, [reportId, user?.access_token, data?.address.postcode])
```

### Anti-Patterns to Avoid

- **Calling WeasyPrint directly in async function without `asyncio.to_thread()`**: blocks the event loop; always use the executor pattern
- **Storing PDF bytes in the database**: do not store the generated PDF in `GeneratedDossier.file_data`; generate on demand and store only metadata (file_size, template_version)
- **Using `datetime.now(timezone.utc)`**: project uses `datetime.utcnow()` for naive UTC (TIMESTAMP WITHOUT TIME ZONE columns)
- **Using `async with db.begin()`**: project uses direct `db.add()/db.flush()/db.commit()` pattern
- **Rendering bodem_data=None as "schone grond"**: DOSSIER-03 requires explicit "geen gegevens beschikbaar" text when `bodem_data is None`
- **Skipping the Wkb disclaimer**: The template must display a prominent disclaimer on every page — do not rely on a single page-1 notice

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML→PDF conversion | Custom PDF generation via ReportLab | `weasyprint` (already installed) | WeasyPrint handles A4, page breaks, running headers/footers, CSS print rules — ReportLab requires explicit coordinate layout |
| Template rendering | String concatenation | `jinja2` (already installed) | Jinja2 handles escaping, conditionals, loops, filters; already used in project |
| Per-page footer/disclaimer | JavaScript injection | WeasyPrint CSS running elements | CSS `position: running(footer)` + `@page @bottom-center` natively repeats on every page |
| File download trigger | Server-side file storage | `fetch()` → `blob()` → anchor click | Blob URL avoids file system storage; already proven in `exportReportPDF()` |

**Key insight:** The entire PDF pipeline is already built and proven in Phase 65. This phase is primarily adding a new template file and a new endpoint — not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: WeasyPrint Blocks Event Loop

**What goes wrong:** Calling `HTML(string=...).write_pdf()` directly in an `async def` endpoint freezes the FastAPI event loop for 1-3 seconds during PDF generation.
**Why it happens:** WeasyPrint is CPU-bound — it parses HTML/CSS, lays out pages, and renders to PDF synchronously.
**How to avoid:** Always use `await asyncio.to_thread(generate_dossier_pdf, ...)` — established pattern from existing `export_report_pdf` endpoint (line 1050 in router.py).
**Warning signs:** Slow endpoint response during testing; other API calls timing out during PDF generation.

### Pitfall 2: bodem_data=None Rendered as Empty Section or "Schone grond"

**What goes wrong:** Template renders empty `<div>` or positive "geen verontreiniging" text when `bodem_data is None`.
**Why it happens:** `None` vs empty list — `bodem_data=None` means data was not fetched; `bodem_data.dossiers=[]` means fetched but no registrations found.
**How to avoid:** Explicit three-state template logic:
  - `bodem_data is None` → render "Bodemkwaliteit: geen gegevens beschikbaar" (DOSSIER-03 requirement)
  - `bodem_data.dossiers == []` → render "Geen geregistreerde verontreiniging gevonden" + disclaimer
  - `bodem_data.dossiers` populated → render dossier rows + disclaimer
**Warning signs:** Success criterion 4 fails in human verify.

### Pitfall 3: Disclaimer Only on Page 1

**What goes wrong:** Disclaimer text appears only in the document body on the first page — not on subsequent pages.
**Why it happens:** Placing disclaimer as a regular `<div>` in body flow.
**How to avoid:** Use WeasyPrint CSS running elements: `position: running(footer)` on the disclaimer div + `@page { @bottom-center { content: element(footer); } }` in `<style>`. This pattern is already proven in `report.html` line 165-177 for the page footer.
**Warning signs:** Multi-page PDFs show disclaimer only on page 1.

### Pitfall 4: Alembic Migration Naming Collision

**What goes wrong:** Two Alembic heads exist if migration `down_revision` is wrong.
**Why it happens:** Not checking the current head before creating migration.
**How to avoid:** Run `alembic heads` to confirm current head. The `down_revision` in the new migration MUST equal the current head revision ID (`f6a7b8c9d0e1` as of this research — verify at implementation time).
**Warning signs:** `alembic upgrade head` reports "multiple heads".

### Pitfall 5: TypeScript Type Mismatch on reportId

**What goes wrong:** Frontend `reportId` prop is `string | undefined` but API call requires non-null string.
**Why it happens:** `ReportDetailPage` receives report data; the report ID must come from the parent (e.g., `useReport` hook) since `PropertyReportResponse` doesn't include the saved report UUID.
**How to avoid:** The CTA button must receive `reportId: string | null` as a prop (matching `sourceParcelId` prop pattern in `ReportDetailPage`). Disable button when `reportId` is null.
**Warning signs:** TypeScript compile error on `generateStartdossier(reportId, ...)` call.

### Pitfall 6: Rate Limit Too Permissive for CPU-Bound Endpoint

**What goes wrong:** Multiple simultaneous PDF generation requests overwhelm the backend CPU.
**Why it happens:** PDF generation is CPU-intensive — WeasyPrint consumes 100% of one CPU for ~1-3 seconds.
**How to avoid:** Rate limit the dossier endpoint at `5/minute` (same as existing PDF export endpoint which uses `10/minute`). WeasyPrint is heavier for the new template.
**Warning signs:** API latency spikes when multiple users generate PDFs simultaneously.

---

## Code Examples

### Dossier Template Structure (wkb_kwaliteitsborger.html)

```html
<!-- Source: pattern from app/reports/templates/report.html -->
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <title>Risicobeoordeling Startdossier — {{ report_name }}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm 2cm 3cm 2cm;
            @bottom-center {
                content: element(footer);
            }
        }
        /* Running footer — repeats on EVERY page */
        .page-footer {
            position: running(footer);
            font-size: 7.5pt;
            color: #555;
            text-align: center;
            border-top: 1px solid #ccc;
            padding-top: 0.4em;
        }
        .disclaimer-box {
            background-color: #fff8e1;
            border-left: 4px solid #e67e00;
            padding: 0.8em 1em;
            margin: 1.5em 0;
            font-size: 9pt;
            line-height: 1.5;
        }
        /* ... standard section/data-row styles ... */
    </style>
</head>
<body>
    <!-- Running footer (mandatory per-page disclaimer) -->
    <div class="page-footer">
        INDICATIEF | Risicobeoordeling Startdossier | Propdex |
        {{ generated_at }} | Niet geschikt als formeel Wkb-nalevingsdocument
    </div>

    <!-- Header -->
    <h1>Risicobeoordeling Startdossier</h1>
    <p class="subtitle">{{ report_name }}</p>
    <p class="meta">Opgesteld door: {{ generated_by }} | Datum: {{ generated_at }}</p>

    <!-- Prominent disclaimer at top of document body -->
    <div class="disclaimer-box">
        <strong>Indicatief document.</strong>
        De gegevens in dit dossier zijn afkomstig uit openbare bronnen (BAG, Kadaster, DSO,
        Bodemloket, EP-Online) en zijn indicatief van aard. Dit document is geen formeel
        Wkb-nalevingsdocument en vervangt niet het oordeel van een erkend kwaliteitsborger
        of bevoegde instantie. Verifieer alle gegevens bij de betreffende bronhouder.
    </div>

    <!-- 1. Perceelgegevens -->
    <!-- 2. Gebouwgegevens (bouwjaar) -->
    <!-- 3. Bodemkwaliteit (3-state: None / empty / dossiers) -->
    <!-- 4. Bestemmingsplan -->
    <!-- 5. Monumentstatus -->
    <!-- 6. Energielabel -->
    <!-- 7. Wkb Classificatie -->
</body>
</html>
```

### Alembic Migration Pattern

```python
# Source: backend/alembic/versions/f6a7b8c9d0e1_*.py (existing migration pattern)
"""Add generated_dossiers table for dossier audit trail.

Revision ID: {auto_generated}
Revises: f6a7b8c9d0e1
Create Date: 2026-03-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "{auto_generated}"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generated_dossiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("saved_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("generated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_size_bytes", sa.Integer, nullable=False),
        sa.Column("template_version", sa.String(20), nullable=False, server_default="v1"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_generated_dossiers_org_id", "generated_dossiers", ["organization_id"])
    op.create_index("ix_generated_dossiers_org_report", "generated_dossiers", ["organization_id", "report_id"])
    op.create_index("ix_generated_dossiers_org_created", "generated_dossiers", ["organization_id", "created_at"])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.print()` browser PDF | WeasyPrint server-side PDF | Phase 65 plan 02 (Phase 65-02 added `@media print`; Phase 65-02 used `window.print()`) | WeasyPrint gives pixel-precise control; browser print depends on user settings |
| Running HTML→PDF per-request | Same (no caching) | N/A | PDF generation is fast enough (~1-3s) for on-demand; caching adds complexity without user value |

**Note:** The existing `window.print()` approach from Phase 65 is for the general property report (browser-initiated). The WeasyPrint approach in `pdf_export.py` is server-initiated and already proven. This phase uses WeasyPrint only.

---

## Open Questions

1. **Where does `reportId` come from in the frontend CTA?**
   - What we know: `ReportDetailPage` receives `data: PropertyReportResponse` which does NOT include the saved report UUID. The UUID is in `ReportDetailResponse` (outer wrapper).
   - What's unclear: Does `ReportDetailPage` currently receive `reportId` as a prop? Grep shows it does not.
   - Recommendation: Plan 69-03 must add `reportId: string | null` prop to `ReportDetailPage` and pass it down. The parent components (report view routes) already have the report UUID from the route params.

2. **Should the dossier be generated from fresh data or saved JSONB?**
   - What we know: The plan calls for generating from `SavedReport.report_data` JSONB (the stored snapshot). This is simpler and avoids re-aggregation.
   - What's unclear: If a report's `bodem_data` was null when saved but data is now available, the dossier will show "geen gegevens beschikbaar".
   - Recommendation: Generate from stored JSONB — consistent with the existing `export_report_pdf` pattern. Add a note in the dossier header showing the data date (`resolved_at`).

3. **Current Alembic head revision?**
   - What we know: The most recent migration is `f6a7b8c9d0e1_add_source_parcel_id_to_saved_reports.py`
   - What's unclear: Whether any untracked migrations exist in the DB
   - Recommendation: Run `alembic heads` before creating migration to confirm current head. Use `f6a7b8c9d0e1` as `down_revision` unless a newer head is found.

---

## Sources

### Primary (HIGH confidence)

- `backend/app/reports/pdf_export.py` — WeasyPrint + Jinja2 generation pattern (existing, verified)
- `backend/app/reports/router.py` lines 1008-1075 — `export_report_pdf` endpoint pattern (existing, verified)
- `backend/app/reports/templates/report.html` lines 165-177 — CSS running elements footer pattern (existing, verified)
- `backend/pyproject.toml` — confirmed `weasyprint>=68.0`, `jinja2>=3.1.0`, `alembic>=1.13.0` all present
- `backend/app/models/report.py` + `base.py` — `TenantMixin` + `TimestampMixin` + `mapped_column()` SQLAlchemy 2.x pattern
- `backend/alembic/versions/f6a7b8c9d0e1_*.py` — confirmed current Alembic head and migration structure
- `frontend/src/lib/api.ts` lines 351-375 — `exportReportPDF()` blob download pattern (existing, verified)
- `backend/app/schemas/property.py` — `PropertyReportResponse` fields confirmed: `bodem_data`, `wkb_classification`, `energy_label`, `monuments`, `zoning`, `building`, `cadastral_parcels`
- `backend/app/schemas/bodem.py` — `BodemData.dossiers=[]` vs `None` distinction confirmed for DOSSIER-03 compliance

### Secondary (MEDIUM confidence)

- WeasyPrint docs on CSS running elements for per-page footers: the `position: running()` + `@page @bottom-center` pattern is well-established in WeasyPrint (confirmed via pattern already in `report.html`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in `pyproject.toml`; existing patterns proven in codebase
- Architecture: HIGH — follows exact existing patterns from Phase 65 PDF export
- Pitfalls: HIGH — identified from codebase patterns and project MEMORY.md (datetime, transaction patterns)
- Open Questions: MEDIUM — frontend `reportId` prop threading needs planner attention

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — stable stack)
