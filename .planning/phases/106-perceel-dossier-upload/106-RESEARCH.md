# Phase 106: Perceel Dossier Upload - Research

**Researched:** 2026-03-11
**Domain:** File upload, document management, multi-tenant file storage
**Confidence:** HIGH

## Summary

Phase 106 adds per-parcel document upload and management to the existing Dossiers tab (`BronnenLayer.tsx`). The Dossiers tab already renders 5 paginated dossier pages (Acquisitie, Technisch, Planologisch, Juridisch, Projectnotities) with 22 total cards, but currently only displays auto-fetched data. This phase adds user-uploaded documents per card.

The project has an established file storage pattern: `PDFDocument` model stores file bytes as PostgreSQL `LargeBinary`. There is no S3/object storage configured and no boto3/minio dependency. For consistency and simplicity, this phase should use the same PostgreSQL `LargeBinary` pattern for document storage. The existing `upload_pdf` endpoint in `properties/router.py` provides a reference implementation for FastAPI `UploadFile` handling.

**Primary recommendation:** Use PostgreSQL `LargeBinary` for file storage (matching existing `PDFDocument` pattern), a new `parcel_documents` table with `TenantMixin`, and extend the Dossiers tab cards with upload/download actions per card key.

<phase_requirements>

## Phase Requirements

Derived from success criteria (no explicit IDs in REQUIREMENTS.md):

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | `parcel_documents` table with parcel_id, org_id, document_type enum, filename, storage_key, uploaded_at | Model pattern from `base.py` TenantMixin, PDFDocument LargeBinary reference |
| DOC-02 | Upload endpoint (POST) with file storage | Existing `upload_pdf` endpoint pattern in `properties/router.py` |
| DOC-03 | Download/preview endpoint (GET) with streaming response | FastAPI StreamingResponse / FileResponse for binary data |
| DOC-04 | Each Dossiers tab card shows upload button + uploaded document status | `BronnenLayer.tsx` card grid with `DossierCard` interface |
| DOC-05 | Multi-tenant isolation: documents scoped to organization_id | TenantMixin pattern, RLS policies on all tenant tables |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >= 0.115 | Upload/download endpoints | Already in use, UploadFile support built-in |
| SQLAlchemy 2.x | >= 2.0.25 | `parcel_documents` model + queries | Project standard ORM |
| python-multipart | >= 0.0.9 | File upload parsing | Already a dependency |
| Alembic | >= 1.13 | Database migration | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | ^5.90 | Upload mutation + document list query | Already used for all API calls |
| lucide-react | ^0.564 | Upload/download icons (FileUp, Download, Trash2) | Already used in BronnenLayer |
| framer-motion | ^12.35 | Upload state animations | Already used in BronnenLayer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL LargeBinary | S3/MinIO object storage | S3 is better for large-scale file storage, but adds infrastructure complexity. No S3 config exists. PostgreSQL LargeBinary is the established pattern (PDFDocument). Switch to S3 later if file volume grows beyond ~10GB |
| Inline LargeBinary | File path on local disk | Filesystem storage is fragile (no backup with DB), breaks Docker portability. DB storage keeps everything in one backup target |

**Installation:**
No new dependencies needed. All required packages are already installed.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── models/parcel_document.py     # New model
├── documents/                     # New module
│   ├── __init__.py
│   ├── router.py                  # Upload/download/delete/list endpoints
│   └── schemas.py                 # Pydantic request/response models
frontend/src/
├── lib/types/document.ts          # TypeScript interfaces
├── lib/api.ts                     # Add document API functions
├── hooks/useDocuments.ts          # React Query hooks
├── components/map/panels/parcel/
│   └── layers/BronnenLayer.tsx    # Extend with upload UI per card
```

### Pattern 1: ParcelDocument Model
**What:** SQLAlchemy model following existing TenantMixin + TimestampMixin pattern
**When to use:** New table for per-parcel user-uploaded documents
**Example:**
```python
# Following PDFDocument and GeneratedDossier patterns
class ParcelDocument(Base, TenantMixin, TimestampMixin):
    __tablename__ = "parcel_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    parcel_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="Kadaster parcel identifier (e.g., HTT02-A-1234)",
    )
    document_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Dossier card key (e.g., 'bodem', 'asbest', 'kadaster')",
    )
    filename: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Original filename as uploaded by user",
    )
    content_type: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="MIME type (application/pdf, image/jpeg, etc.)",
    )
    file_data: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False,
        comment="File bytes (max 25MB)",
    )
    file_size: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="File size in bytes",
    )
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        Index("ix_parcel_documents_org_parcel", "organization_id", "parcel_id"),
        Index("ix_parcel_documents_org_parcel_type", "organization_id", "parcel_id", "document_type"),
    )
```

### Pattern 2: Upload Endpoint (following existing upload_pdf pattern)
**What:** POST endpoint accepting multipart file upload
**When to use:** User uploads document for a dossier card
**Example:**
```python
@router.post("/{parcel_id}/documents")
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    parcel_id: str,
    document_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    file_bytes = await file.read()
    # Validate size (25MB max), type (PDF/image/docx), document_type enum
    doc = ParcelDocument(
        parcel_id=parcel_id,
        document_type=document_type,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        file_data=file_bytes,
        file_size=len(file_bytes),
        uploaded_by_user_id=current_user.id,
        organization_id=organization_id,
    )
    db.add(doc)
    await db.commit()
    return DocumentResponse(id=doc.id, filename=doc.filename, ...)
```

### Pattern 3: Download Endpoint (streaming binary response)
**What:** GET endpoint returning file bytes with correct Content-Type
**When to use:** User downloads or previews uploaded document
**Example:**
```python
from fastapi.responses import Response

@router.get("/{parcel_id}/documents/{document_id}")
async def download_document(
    parcel_id: str,
    document_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    doc = await db.execute(
        select(ParcelDocument).where(
            ParcelDocument.id == document_id,
            ParcelDocument.parcel_id == parcel_id,
            ParcelDocument.organization_id == organization_id,
        )
    )
    doc = doc.scalar_one_or_none()
    if not doc:
        raise HTTPException(404)
    return Response(
        content=doc.file_data,
        media_type=doc.content_type,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )
```

### Pattern 4: Frontend Upload with FormData
**What:** `apiFetch` does not support FormData (it auto-sets Content-Type to JSON). Use raw `fetch` for uploads.
**When to use:** Uploading files from frontend
**Example:**
```typescript
// Must use raw fetch (not apiFetch) since body is FormData, not JSON
// Same pattern as fetchAerialCrop which uses raw fetch for binary
export async function uploadDocument(
  parcelId: string,
  documentType: string,
  file: File,
  accessToken: string,
): Promise<DocumentResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(
    `/api/documents/${parcelId}/documents?document_type=${encodeURIComponent(documentType)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      body: formData,
    },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

### Anti-Patterns to Avoid
- **Storing files on local filesystem:** Breaks Docker portability, no backup with DB, volume management headaches
- **Using apiFetch for file uploads:** It sets `Content-Type: application/json` for non-GET requests with body. Use raw `fetch` with `FormData` (browser auto-sets multipart boundary)
- **Loading file_data in list queries:** Always `defer()` or exclude `file_data` column when listing documents. Only load bytes on download
- **Allowing unlimited file sizes:** Set a reasonable max (25MB). The existing PDF upload uses 100MB but that's for bestemmingsplan PDFs which can be huge
- **Missing document_type validation:** Validate against the known card keys from BronnenLayer to prevent arbitrary types

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload parsing | Custom multipart parser | FastAPI `UploadFile` + `python-multipart` | Already handles streaming, temp files, content-type detection |
| MIME type validation | Custom magic byte checking | Check `file.content_type` + extension allowlist | Sufficient for user uploads, browser provides content-type |
| File serving | Custom streaming implementation | FastAPI `Response(content=bytes, media_type=...)` | Built-in, handles headers correctly |
| Deferred column loading | Manual separate queries | SQLAlchemy `defer(ParcelDocument.file_data)` in list queries | ORM-native lazy loading |

## Common Pitfalls

### Pitfall 1: Loading file_data in list queries
**What goes wrong:** Listing documents for a parcel loads all file bytes into memory
**Why it happens:** SQLAlchemy eager-loads all columns by default
**How to avoid:** Use `defer(ParcelDocument.file_data)` in list queries, or select only metadata columns
**Warning signs:** Memory spikes when opening Dossiers tab for parcels with many uploads

### Pitfall 2: apiFetch Content-Type conflict
**What goes wrong:** File upload fails with 422 because Content-Type is set to application/json
**Why it happens:** `apiFetch` in `api.ts` lines 85-87 auto-set `Content-Type: application/json` for non-GET with body
**How to avoid:** Use raw `fetch` for FormData uploads (same as `fetchAerialCrop` pattern)
**Warning signs:** 422 Unprocessable Entity on upload attempts

### Pitfall 3: Missing RLS policy for new table
**What goes wrong:** Cross-tenant document access after migration
**Why it happens:** Alembic migration creates table but forgets RLS policy
**How to avoid:** Check existing migration `0800fa8394d7_enable_rls_on_all_tenant_tables.py` for pattern. Add RLS in the same migration that creates the table
**Warning signs:** Users from org A can see org B documents

### Pitfall 4: Document type as Python Enum vs string
**What goes wrong:** Adding new dossier card types requires migration
**Why it happens:** Using PostgreSQL ENUM type for document_type
**How to avoid:** Use `String(50)` for document_type and validate against an allowlist in application code. The card keys in BronnenLayer may evolve
**Warning signs:** Migration errors when adding new card types

### Pitfall 5: Transaction pattern
**What goes wrong:** "Transaction already begun" errors
**Why it happens:** Using `async with db.begin()` instead of direct commit
**How to avoid:** Use direct `db.add() / db.flush() / db.commit()` pattern (project standard from MEMORY.md)
**Warning signs:** TransactionError in upload endpoint

## Code Examples

### Document Type Allowlist (from BronnenLayer card keys)
```python
# Source: frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx
VALID_DOCUMENT_TYPES = {
    # Acquisitie
    "bestemmingscheck", "perceeldata", "vergunninghistorie", "woz", "quickscan",
    # Technisch
    "bodem", "fundering", "asbest", "bouwkundig", "energielabel",
    # Planologisch
    "bestemmingsplan", "milieuzones", "geluid", "stikstof",
    # Juridisch
    "kadaster", "eigendom", "erfpacht",
    # Projectnotities
    "documenten", "correspondentie", "ideeen",
}
```

### Allowed File Types
```python
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
```

### React Query Hook Pattern
```typescript
// Following useParcelEnrichment pattern from hooks/useScans.ts
export function useParcelDocuments(parcelId: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: ['parcel-documents', parcelId],
    queryFn: () => fetchDocuments(parcelId!, accessToken!),
    enabled: !!parcelId && !!accessToken,
  })
}

export function useUploadDocument() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { parcelId: string; documentType: string; file: File }) =>
      uploadDocument(vars.parcelId, vars.documentType, vars.file, accessToken!),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parcel-documents', vars.parcelId] })
    },
  })
}
```

### BronnenLayer Card Extension
```typescript
// Each DossierCard gets an upload action when not filled
// When filled with user document, show filename + download link
interface DossierCard {
  key: string
  label: string
  Icon: LucideIcon
  value: string
  sub: string
  filled: boolean
  document?: ParcelDocumentMeta  // NEW: attached user document
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LargeBinary in DB | S3-compatible object storage | Industry standard since ~2018 | Project uses LargeBinary (PDFDocument). Fine for current scale. Migrate to S3 if file volume exceeds ~10GB or need CDN |

**Current project approach:** PostgreSQL LargeBinary is appropriate for the expected volume (developer uploads per parcel = low volume, typically PDFs under 10MB).

## Open Questions

1. **Delete permission model**
   - What we know: Multi-tenant isolation via org_id is mandatory
   - What's unclear: Can any org member delete any document, or only the uploader?
   - Recommendation: Allow deletion by any org member (simplest), track `uploaded_by_user_id` for audit

2. **Multiple documents per card type**
   - What we know: Each card represents a dossier category (e.g., "bodem", "asbest")
   - What's unclear: Can users upload multiple documents per card type per parcel?
   - Recommendation: Allow multiple (no unique constraint on parcel_id + document_type). Show count in card, list on expand

3. **File versioning**
   - What we know: Users may want to replace documents
   - What's unclear: Keep old versions or overwrite?
   - Recommendation: Keep all uploads (append-only), let user delete old ones manually. No versioning complexity needed for MVP

## Sources

### Primary (HIGH confidence)
- `backend/app/models/base.py` - TenantMixin, TimestampMixin patterns
- `backend/app/models/pdf_document.py` - LargeBinary file storage pattern
- `backend/app/properties/router.py` lines 248-320 - UploadFile endpoint pattern
- `backend/app/main.py` - Router registration pattern
- `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx` - Dossiers tab UI with 22 card keys
- `frontend/src/lib/api.ts` - apiFetch wrapper (Content-Type auto-set caveat)
- `backend/app/auth/dependencies.py` - Auth dependency injection pattern
- `backend/pyproject.toml` - Confirmed python-multipart already in dependencies

### Secondary (MEDIUM confidence)
- FastAPI UploadFile documentation - file upload handling
- SQLAlchemy `defer()` for lazy column loading

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - follows existing model/router/frontend patterns exactly
- Pitfalls: HIGH - identified from direct codebase inspection (apiFetch Content-Type, RLS, transaction pattern)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable domain, no external API dependencies)
