# Phase 4: AI Document Parsing - Research

**Researched:** 2026-02-07
**Domain:** AI-powered PDF document parsing with async job processing
**Confidence:** HIGH

## Summary

Phase 4 implements AI-powered parsing of bestemmingsplan PDFs using Claude API when DSO API provides insufficient detail. Research confirms Claude's native PDF support handles complex legal documents with tables, charts, and footnotes. ARQ (Async Redis Queue) emerges as the optimal task queue for FastAPI async workflows, providing lightweight job tracking with Redis-backed persistence. The phase requires structured output extraction via JSON schemas, plan-level caching for cost control (90% savings on repeated plans), and polling-based progress tracking for background jobs. File storage follows hybrid pattern: PDFs in PostgreSQL BYTEA (under 100MB limit), metadata in existing cache tables, job state in Redis. IMRO plan identifiers enable deterministic cache keys across addresses.

**Primary recommendation:** Use Claude API PDF support with ARQ task queue, Pydantic-defined structured outputs, and plan-level prompt caching for cost-effective async parsing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PDF Acquisition:**
- Auto-download from Ruimtelijkeplannen.nl as primary source, user upload as fallback
- PDF only, 100MB max file size for uploads
- PDFs stored permanently linked to the property/plan — not deleted after parsing
- Cache parsed results by plan ID — if bestemmingsplan "Centrum 2018" is already parsed for Address A, reuse for Address B in the same plan area

**Job Lifecycle:**
- Fully async — user can navigate away, parsing continues in background; results appear when they return
- Progressive loading: API data (kadaster, basic zoning, monuments) shown immediately, AI-parsed section loads when ready with loading indicator
- Always parse — every property lookup triggers bestemmingsplan PDF parsing alongside API calls

**AI Output Structure:**
- Deep extraction: permitted/forbidden uses, building dimensions, parking norms, environmental restrictions, special conditions, article references — unless gap-filling-only proves significantly cheaper in token costs (Claude evaluates during research)
- Overall confidence score for the AI parsing + individual flags only on LOW-confidence items needing manual verification
- Disclaimers: section-level banner ("AI-geanalyseerd — Controleer bij notaris voor investeringsbeslissingen") + per-item warnings on LOW-confidence flagged items
- Article references included per extracted rule for source verification, but presented in a non-cluttered way (e.g., collapsible, secondary text)

**Fallback When PDF Not Found:**
- Show API data as-is (report still has value without AI parsing)
- Display notice: "Bestemmingsplan niet digitaal beschikbaar" with option to upload PDF manually
- No re-parse button needed — once parsed, results are final

### Claude's Discretion

**Download scope:**
- Claude determines whether to fetch most relevant plan only or all active plans per location based on technical research
- **Research finding:** Fetch most relevant plan only (primary bestemmingsplan from DSO API response) to minimize storage and parsing costs. Multiple active plans per location are rare for same property, and most relevant plan (determined by DSO spatial query) covers the property adequately.

**Status tracking & failure handling:**
- Claude determines polling vs WebSocket for job status updates
- **Research finding:** Use polling pattern with dedicated status endpoint. FastAPI + ARQ support polling naturally via job ID queries. WebSocket adds complexity without material UX benefit for 10-30s parse jobs. Polling every 2-3 seconds provides responsive feedback.
- Claude determines retry strategy on parsing failure (auto-retry vs immediate fail with options)
- **Research finding:** No auto-retry. Immediate fail with clear error message and manual upload option. Claude API failures (rate limits, service errors) are transient but unpredictable; bestemmingsplan parsing is one-time operation where user can upload PDF as fallback. Auto-retry risks cost escalation and delayed error feedback.

**Token cost evaluation:**
- Deep extraction vs gap-filling-only based on token cost analysis
- **Research finding:** Deep extraction is cost-effective. Claude PDF parsing: ~1,500-3,000 tokens/page for text + ~7,800 tokens/page for images. 30-page bestemmingsplan ≈ 250k tokens ($3-5 with Opus 4.6, $0.75-1.25 with Sonnet 4.5). Prompt caching reduces repeat parsing by 90% (same plan across multiple addresses). Gap-filling approach still requires full PDF read to identify gaps, eliminating cost advantage. Deep extraction provides superior value proposition for developers.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

## Standard Stack

The established libraries/tools for AI document parsing with async job processing:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| anthropic | >=0.40.0 | Claude API client with PDF support | Official SDK with native PDF handling, Pydantic integration, prompt caching |
| arq | >=0.27.0 | Async Redis task queue | Asyncio-native, lightweight, FastAPI-optimized alternative to Celery |
| redis | >=5.0.0 | In-memory data store (already in deps) | Job state persistence, ARQ message broker |
| pydantic | >=2.0 (via FastAPI) | Schema validation | Type-safe structured outputs, existing project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-multipart | >=0.0.9 (existing) | File upload handling | User-uploaded PDFs when auto-download fails |
| httpx[http2] | >=0.27.0 (existing) | HTTP client for PDF downloads | Fetch bestemmingsplan PDFs from Ruimtelijkeplannen.nl |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ARQ | Celery | Celery is battle-tested with extensive features but synchronous-first design requires extra async integration. ARQ is simpler, faster for I/O-bound tasks, native asyncio. Project already fully async (FastAPI, SQLAlchemy async). |
| ARQ | FastAPI BackgroundTasks | BackgroundTasks lacks job tracking, persistence, failure handling. Unsuitable for 10-30s parsing jobs requiring status polling. Use only for <5s lightweight tasks. |
| Claude PDF | Custom PDF extraction (pypdf, pdfplumber) + Claude text | Claude native PDF processing handles visual elements (tables, charts, footnotes) that text-only extraction misses. Bestemmingsplannen contain critical data in visual layouts. Custom extraction adds complexity without benefit. |
| PostgreSQL BYTEA | S3/MinIO object storage | S3 adds infrastructure dependency for MVP. BYTEA handles 100MB limit adequately (bestemmingsplannen typically 5-30MB). Hybrid metadata approach (PostgreSQL) + file storage (BYTEA) keeps architecture simple. Future: migrate to S3 if file sizes exceed limits. |

**Installation:**

```bash
# Add to pyproject.toml dependencies
anthropic>=0.40.0  # Claude API with PDF support
arq>=0.27.0        # Async task queue
# redis>=5.0.0 already exists
# pydantic, httpx, python-multipart already exist
```

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── ai/                      # NEW: AI parsing module
│   │   ├── __init__.py
│   │   ├── claude_client.py     # Claude API wrapper with PDF support
│   │   ├── schemas.py           # Pydantic models for structured outputs
│   │   └── prompts.py           # Parsing prompts with Dutch templates
│   ├── jobs/                    # NEW: Background job workers
│   │   ├── __init__.py
│   │   ├── worker.py            # ARQ worker configuration
│   │   └── pdf_parsing.py      # PDF parsing job functions
│   ├── models/
│   │   ├── pdf_document.py     # NEW: PDF storage model (BYTEA)
│   │   └── parsing_job.py      # NEW: Job metadata model
│   ├── services/
│   │   ├── pdf_downloader.py   # NEW: Download PDFs from Ruimtelijkeplannen.nl
│   │   └── plan_aggregator.py  # NEW: Merge DSO + AI-parsed data
│   └── properties/
│       └── router.py            # Add endpoints: /lookup (trigger parse), /status/{job_id}
```

### Pattern 1: ARQ Task Queue Setup

**What:** ARQ worker runs separately from FastAPI, processes jobs from Redis queue, stores results in PostgreSQL.

**When to use:** All async operations >5s requiring job tracking, retries, or progress monitoring.

**Example:**

```python
# app/jobs/worker.py
from arq import create_pool
from arq.connections import RedisSettings

async def pdf_parsing_job(ctx, plan_id: str, pdf_url: str, organization_id: str):
    """
    Background job: Download PDF, parse with Claude, store results.

    Job state tracked in Redis, results stored in PostgreSQL.
    """
    # Download PDF from Ruimtelijkeplannen.nl
    pdf_data = await download_pdf(pdf_url)

    # Parse with Claude API
    parsed_data = await claude_client.parse_bestemmingsplan(pdf_data, plan_id)

    # Store in database (cache by plan_id)
    await save_parsed_results(plan_id, parsed_data, organization_id)

    return {"plan_id": plan_id, "status": "completed"}

class WorkerSettings:
    functions = [pdf_parsing_job]
    redis_settings = RedisSettings(host="localhost", port=6379)
    max_jobs = 10  # Concurrent parsing jobs
    job_timeout = 300  # 5 minutes for Claude API + DB operations

# Run worker: arq app.jobs.worker.WorkerSettings
```

**Integration with FastAPI:**

```python
# app/main.py
from arq import create_pool
from arq.connections import RedisSettings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create ARQ pool
    app.state.arq_pool = await create_pool(RedisSettings())
    yield
    # Shutdown: close pool
    await app.state.arq_pool.close()

app = FastAPI(lifespan=lifespan)

# app/properties/router.py
@router.post("/lookup")
async def property_lookup(request: Request, ...):
    # Enqueue PDF parsing job
    job = await request.app.state.arq_pool.enqueue_job(
        "pdf_parsing_job",
        plan_id="NL.IMRO.0363.BP2024CENTRUM-VA01",
        pdf_url="https://...",
        organization_id=str(organization_id)
    )

    return {"job_id": job.job_id, "status": "processing"}
```

### Pattern 2: Polling-Based Status Endpoint

**What:** Client polls `/jobs/{job_id}/status` every 2-3s to track progress. Job state from Redis (via ARQ), results from PostgreSQL.

**When to use:** All async jobs where client needs progress updates without WebSocket complexity.

**Example:**

```python
# app/properties/router.py
from arq.jobs import Job

@router.get("/jobs/{job_id}/status")
async def job_status(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Poll job status from ARQ Redis queue.

    Returns:
    - queued: Job in Redis queue, not started
    - in_progress: Worker processing job
    - complete: Results available in PostgreSQL
    - not_found: Job expired (Redis TTL) or invalid ID
    """
    job = Job(job_id, redis=request.app.state.arq_pool)
    info = await job.info()

    if not info:
        return {"status": "not_found"}

    if info.success:
        # Fetch parsed results from PostgreSQL
        parsed_data = await get_parsed_results(info.result["plan_id"])
        return {
            "status": "complete",
            "data": parsed_data
        }
    elif info.status == JobStatus.in_progress:
        return {"status": "in_progress", "progress": 50}  # Claude parsing
    else:
        return {"status": "queued"}
```

**Frontend polling pattern:**

```typescript
// Poll every 2 seconds until complete
const pollJobStatus = async (jobId: string) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/jobs/${jobId}/status`);
    const data = await response.json();

    if (data.status === 'complete') {
      clearInterval(interval);
      // Update UI with parsed data
    }
  }, 2000);
};
```

### Pattern 3: Claude PDF Parsing with Structured Outputs

**What:** Send PDF to Claude via base64 encoding, extract structured JSON using Pydantic schemas, cache prompt for 90% cost reduction on repeated plans.

**When to use:** All bestemmingsplan PDF parsing operations.

**Example:**

```python
# app/ai/schemas.py (Pydantic models for structured outputs)
from pydantic import BaseModel, Field

class BestemmingsregelExtract(BaseModel):
    """Single zoning rule extracted from bestemmingsplan."""
    artikel: str = Field(description="Article reference (e.g., 'Artikel 3.1.2')")
    bestemming: str = Field(description="Zoning designation")
    toegestane_gebruiken: list[str] = Field(description="Permitted uses")
    verboden_gebruiken: list[str] = Field(description="Forbidden uses")
    bouwregels: dict = Field(description="Building dimensions: max_height, max_oppervlakte, etc.")
    parkeereis: str | None = Field(default=None, description="Parking requirement")
    bijzondere_voorwaarden: list[str] = Field(default_factory=list, description="Special conditions")
    confidence: str = Field(description="HIGH, MEDIUM, or LOW based on text clarity")

class BestemmingsplanParsed(BaseModel):
    """Complete parsed bestemmingsplan output."""
    plan_naam: str
    plan_idn: str  # NL.IMRO identifier
    regels: list[BestemmingsregelExtract]
    overall_confidence: str = Field(description="Overall parsing confidence")
    disclaimers: list[str] = Field(description="Dutch disclaimers for low-confidence items")

# app/ai/claude_client.py
import anthropic
import base64
from anthropic import transform_schema

class ClaudeClient:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    async def parse_bestemmingsplan(
        self,
        pdf_data: bytes,
        plan_idn: str
    ) -> BestemmingsplanParsed:
        """
        Parse bestemmingsplan PDF with Claude API.

        Uses prompt caching for 90% cost reduction on repeated plans.
        """
        pdf_base64 = base64.standard_b64encode(pdf_data).decode("utf-8")

        message = self.client.messages.parse(
            model="claude-sonnet-4-5",  # $3/MTok input, $15/MTok output
            max_tokens=16000,  # ~10k for response, buffer for complex plans
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_base64
                            },
                            # CRITICAL: Enable prompt caching for 90% savings
                            "cache_control": {"type": "ephemeral"}
                        },
                        {
                            "type": "text",
                            "text": BESTEMMINGSPLAN_PARSING_PROMPT  # See Pattern 4
                        }
                    ]
                }
            ],
            output_format=BestemmingsplanParsed,  # Pydantic schema -> structured JSON
        )

        return message.parsed_output
```

**Token cost calculation:**

- 30-page bestemmingsplan: ~250k input tokens
- First parse: 250k × $3/MTok = $0.75 input (Sonnet 4.5)
- Cached parse: 250k × $0.30/MTok = $0.075 input (90% discount)
- Output ~10k tokens: 10k × $15/MTok = $0.15
- **Total first parse: ~$0.90, subsequent: ~$0.23**

### Pattern 4: Dutch Parsing Prompt with Confidence Scoring

**What:** Structured prompt instructs Claude to extract zoning rules, assign confidence scores, and generate Dutch disclaimers.

**When to use:** All Claude parsing requests for legal/regulatory documents.

**Example:**

```python
# app/ai/prompts.py
BESTEMMINGSPLAN_PARSING_PROMPT = """
Je bent een expert in het analyseren van Nederlandse bestemmingsplannen.
Extraheer uit dit PDF-document alle relevante bestemmingsregels voor vastgoedontwikkelaars.

**Te extraheren per regel:**
1. Artikelverwijzing (bijv. "Artikel 3.1.2 Wonen")
2. Bestemming (bijv. "Woongebied", "Gemengd gebied")
3. Toegestane gebruiken (bijv. ["wonen", "kantoor aan huis"])
4. Verboden gebruiken (bijv. ["bedrijfsmatige activiteiten", "horeca"])
5. Bouwregels (maximale hoogte, oppervlakte, bebouwingspercentage)
6. Parkeereis (bijv. "2 parkeerplaatsen per woning")
7. Bijzondere voorwaarden (wijzigingsbevoegdheden, uitzonderingen)

**Vertrouwensscore (confidence):**
- HIGH: Duidelijke, eenduidige regeltekst
- MEDIUM: Verwijzingen naar andere artikelen, voorwaardelijke regels
- LOW: Onduidelijke formuleringen, tegenstrijdigheden, ontbrekende informatie

**Disclaimers (alleen voor LOW-confidence items):**
Genereer Nederlandse waarschuwingen voor items met lage betrouwbaarheid:
- "Artikel {X} bevat onduidelijke formuleringen — raadpleeg notaris"
- "Mogelijke tegenstrijdigheid tussen artikel {X} en {Y} — verificatie vereist"

**Overall confidence:**
Beoordeel de algehele parseerbaarheid van het document (HIGH/MEDIUM/LOW).

**Belangrijk:**
- Extraheer ALLE regels, ook die met LOW confidence
- Behoud exacte artikelverwijzingen voor bronchecking
- Focus op ontwikkelingsrelevante informatie (bouwmogelijkheden, restricties)
"""
```

### Pattern 5: Plan-Level Caching Strategy

**What:** Cache parsed results by IMRO plan identifier (NL.IMRO.{gemeente}.{plan}-{version}), not by address. Multiple addresses in same plan area reuse cached parse.

**When to use:** All PDF parsing operations to minimize Claude API costs.

**Example:**

```python
# app/services/plan_aggregator.py
async def get_or_parse_plan(
    plan_idn: str,  # NL.IMRO.0363.BP2024CENTRUM-VA01
    organization_id: uuid.UUID,
    session: AsyncSession,
    arq_pool
) -> BestemmingsplanParsed | JobReference:
    """
    Fetch cached parsed plan or enqueue new parsing job.

    Cache key: f"ai_parsed:{plan_idn}" (shared across addresses)
    """
    cache_key = f"ai_parsed:{plan_idn}"

    # Check if already parsed (cached in database)
    cached = await get_cached_or_fetch(
        cache_key=cache_key,
        source="bestemmingsplan",  # 90-day TTL
        organization_id=organization_id,
        fetch_fn=None,  # Don't auto-fetch, return cache miss
        session=session
    )

    if cached.is_cached:
        return BestemmingsplanParsed(**cached.data)

    # Check if job already running
    existing_job = await find_active_job(plan_idn)
    if existing_job:
        return JobReference(job_id=existing_job.job_id, status="processing")

    # Enqueue new parsing job
    job = await arq_pool.enqueue_job(
        "pdf_parsing_job",
        plan_id=plan_idn,
        pdf_url=construct_pdf_url(plan_idn),
        organization_id=str(organization_id)
    )

    return JobReference(job_id=job.job_id, status="queued")
```

**Cache reuse example:**

- Address A (Kerkstraat 10): Parse plan "NL.IMRO.0363.BP2024CENTRUM-VA01" → $0.90
- Address B (Kerkstraat 25, same plan): Fetch cached parse → $0 (cache hit)
- Address C (Marktplein 5, same plan): Fetch cached parse → $0 (cache hit)

### Pattern 6: Hybrid File Storage (PostgreSQL BYTEA)

**What:** Store PDF bytes in PostgreSQL BYTEA column, metadata in separate table. Link to parsed results via plan_idn.

**When to use:** PDFs under 100MB (bestemmingsplannen typically 5-30MB). Migrate to S3 if files exceed limits.

**Example:**

```python
# app/models/pdf_document.py
from sqlalchemy import LargeBinary, String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, OrganizationMixin

class PDFDocument(Base, TimestampMixin, OrganizationMixin):
    """
    Bestemmingsplan PDF storage with metadata.

    PDFs stored permanently, linked to plan_idn for reuse across addresses.
    """
    __tablename__ = "pdf_documents"

    plan_idn: Mapped[str] = mapped_column(
        String(100),
        index=True,
        comment="IMRO plan identifier (NL.IMRO.{gemeente}.{plan}-{version})"
    )
    file_data: Mapped[bytes] = mapped_column(
        LargeBinary,
        comment="PDF bytes (max 100MB)"
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        comment="File size in bytes"
    )
    source_url: Mapped[str | None] = mapped_column(
        String(500),
        comment="Original download URL from Ruimtelijkeplannen.nl"
    )
    is_user_uploaded: Mapped[bool] = mapped_column(
        default=False,
        comment="True if manually uploaded, False if auto-downloaded"
    )

    # Composite index for tenant + plan lookups
    __table_args__ = (
        Index("ix_pdf_org_plan", "organization_id", "plan_idn"),
    )
```

**Storage operation:**

```python
# app/services/pdf_downloader.py
async def download_and_store_pdf(
    plan_idn: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
    client: httpx.AsyncClient
) -> PDFDocument:
    """Download PDF from Ruimtelijkeplannen.nl, store in PostgreSQL."""

    # Check if already stored
    stmt = select(PDFDocument).where(
        PDFDocument.organization_id == organization_id,
        PDFDocument.plan_idn == plan_idn
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        return existing

    # Download PDF
    url = construct_pdf_url(plan_idn)
    response = await client.get(url)
    response.raise_for_status()

    pdf_data = response.content
    if len(pdf_data) > 100 * 1024 * 1024:  # 100MB limit
        raise ValueError("PDF exceeds 100MB limit")

    # Store in database
    pdf_doc = PDFDocument(
        organization_id=organization_id,
        plan_idn=plan_idn,
        file_data=pdf_data,
        file_size=len(pdf_data),
        source_url=url,
        is_user_uploaded=False
    )
    session.add(pdf_doc)
    await session.flush()
    await session.commit()

    return pdf_doc
```

### Anti-Patterns to Avoid

- **Parsing same plan multiple times:** Always check plan_idn cache before enqueueing job. Cost: $0.90/parse vs $0/cached.
- **Storing parsed results in Redis:** ARQ job results expire. Store in PostgreSQL CachedAPIResponse for 90-day persistence.
- **Synchronous PDF download in API endpoint:** Use ARQ job to download+parse. Avoids HTTP timeout on slow downloads (10-30s).
- **Base64 encoding PDF in database:** Store raw bytes in BYTEA. Base64 inflates size by 33%.
- **Auto-retry on Claude API errors:** Transient failures (rate limits) resolve unpredictably. Let user trigger manual retry or upload PDF.
- **WebSocket for job status:** Adds connection management complexity. Polling every 2-3s provides adequate UX for 10-30s jobs.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | pypdf2 + regex parsing | Claude native PDF support | Claude handles visual elements (tables, charts, footnotes) that text extraction misses. Bestemmingsplannen contain critical data in visual layouts. |
| Task queue with job tracking | Custom Redis pub/sub + status table | ARQ | ARQ provides job tracking, retries, result storage, worker management out-of-box. Custom solution requires building all primitives. |
| Structured JSON extraction from LLM | Prompt engineering + JSON.parse() | Claude structured outputs | Guarantees valid JSON matching Pydantic schema. No retry loops for malformed JSON. |
| Prompt caching for repeated content | Manual deduplication logic | Claude prompt caching | Native feature with 90% cost reduction. Cache invalidation, TTL handled by Anthropic. |
| File upload validation | Manual size checks + MIME detection | FastAPI File with python-multipart | Existing dependency. Handles streaming uploads, size limits, MIME validation. |
| Progress tracking UI | Custom WebSocket implementation | HTTP polling pattern | Simpler client code, no connection management, adequate for 10-30s jobs. WebSocket adds complexity without UX benefit. |

**Key insight:** Claude's PDF + structured outputs eliminate the need for custom PDF parsing and JSON validation pipelines. ARQ's job tracking eliminates need for custom status tables and worker management. Both are production-ready and widely adopted.

## Common Pitfalls

### Pitfall 1: Token Costs Escalation Without Caching

**What goes wrong:** Parsing 30-page bestemmingsplan costs $0.90 per address. 100 lookups/day in same plan = $90/day.

**Why it happens:** Forgetting to cache by plan_idn instead of address. Each lookup triggers new Claude API call.

**How to avoid:**
1. Cache parsed results by plan_idn (IMRO identifier), not address coordinates
2. Enable prompt caching (`cache_control: {"type": "ephemeral"}`) on PDF document block
3. First parse costs $0.90, subsequent 90% cheaper ($0.09) within 24h cache window
4. Store parsed results in PostgreSQL with 90-day TTL (bestemmingsplan changes are rare)

**Warning signs:**
- Claude API costs scale linearly with lookup volume
- Same plan parsed multiple times in ARQ job logs
- Cache hit rate <50% for plan lookups

### Pitfall 2: Job ID Leakage Across Tenants

**What goes wrong:** ARQ job IDs are globally unique but not tenant-scoped. Organization A can query Organization B's job status.

**Why it happens:** `/jobs/{job_id}/status` endpoint doesn't validate organization_id ownership.

**How to avoid:**
1. Store job metadata in PostgreSQL with organization_id
2. Validate tenant ownership before returning job status:
   ```python
   job_meta = await get_job_metadata(job_id)
   if job_meta.organization_id != current_user.organization_id:
       raise HTTPException(403, "Access denied")
   ```
3. Alternative: Include organization_id in job_id (e.g., `{org_id}:{uuid}`)

**Warning signs:**
- Job status returns data for wrong tenant
- No organization_id check in status endpoint

### Pitfall 3: Unbounded Claude API Calls on Retry

**What goes wrong:** Auto-retry on Claude API failures (rate limits, 500 errors) leads to cost escalation. $0.90/parse × 5 retries = $4.50 wasted.

**Why it happens:** ARQ max_tries=3 default retries transient errors. Claude rate limits resolve unpredictably (could be minutes to hours).

**How to avoid:**
1. Set `max_tries=1` for pdf_parsing_job (no auto-retry)
2. On failure, store error in job result: `{"status": "failed", "error": "Claude API rate limit"}`
3. Frontend shows error + manual upload option
4. User uploads PDF as fallback, bypassing Claude API dependency

**Warning signs:**
- Claude API costs spike during outages
- Jobs stuck in retry loop for hours
- Parsing jobs consume max_tries quota

### Pitfall 4: PDF Download Timeout in HTTP Request

**What goes wrong:** Downloading 20MB bestemmingsplan PDF in POST /lookup endpoint takes 10-15s, risks HTTP timeout.

**Why it happens:** Sequential flow: download PDF → parse with Claude → return result. Total time 20-40s exceeds typical timeout.

**How to avoid:**
1. POST /lookup returns immediately with job_id (HTTP 202 Accepted)
2. ARQ job downloads PDF in background:
   ```python
   async def pdf_parsing_job(ctx, plan_idn: str, pdf_url: str, ...):
       pdf_data = await download_pdf(pdf_url)  # 10-15s
       parsed = await claude_client.parse(pdf_data)  # 10-30s
       await save_results(parsed)
   ```
3. Client polls /jobs/{job_id}/status every 2-3s
4. Progressive loading: Show API data (kadaster, zoning) immediately, AI-parsed section loads when ready

**Warning signs:**
- HTTP 504 Gateway Timeout errors on /lookup
- Users report "loading spinner stuck"
- PDF downloads block API responsiveness

### Pitfall 5: Storing Parsed Results Only in Redis

**What goes wrong:** ARQ stores job results in Redis with default TTL (1 hour). After expiration, parsed data lost. Re-parsing costs $0.90.

**Why it happens:** Assuming ARQ job results persist long-term. Redis is ephemeral cache, not durable storage.

**How to avoid:**
1. pdf_parsing_job stores results in PostgreSQL CachedAPIResponse:
   ```python
   await save_parsed_results(
       cache_key=f"ai_parsed:{plan_idn}",
       data=parsed_data,
       source="bestemmingsplan",  # 90-day TTL
       organization_id=organization_id
   )
   ```
2. ARQ job result contains only reference: `{"plan_idn": "...", "status": "completed"}`
3. GET /jobs/{job_id}/status fetches from PostgreSQL, not Redis
4. Cache survives Redis restarts, worker crashes

**Warning signs:**
- "Job not found" errors after 1 hour
- Users report parsed data disappears
- High re-parsing rate for same plans

### Pitfall 6: Missing IMRO Plan Identifier Validation

**What goes wrong:** Invalid plan_idn (`NL.IMRO.INVALID`) causes PDF download failures, wasted API calls.

**Why it happens:** DSO API returns plan identifiers in response, but malformed data occasionally occurs.

**How to avoid:**
1. Validate IMRO format before enqueueing job:
   ```python
   import re
   IMRO_PATTERN = re.compile(r'^NL\.IMRO\.\d{4}\.[A-Z0-9]{1,18}-[A-Z0-9]{1,4}$')

   if not IMRO_PATTERN.match(plan_idn):
       raise ValueError(f"Invalid IMRO identifier: {plan_idn}")
   ```
2. Construct PDF URL from validated plan_idn:
   ```python
   # Ruimtelijkeplannen.nl pattern (example, verify actual URL structure)
   url = f"https://www.ruimtelijkeplannen.nl/documents/{plan_idn}/{plan_idn}.pdf"
   ```
3. Fallback: If download fails, mark plan as "niet digitaal beschikbaar" (not digitally available)

**Warning signs:**
- 404 errors on PDF downloads
- Jobs fail with "PDF not found" despite DSO API returning plan_idn

## Code Examples

Verified patterns from official sources:

### Example 1: Claude PDF Parsing with Prompt Caching

```python
# Source: https://platform.claude.com/docs/en/build-with-claude/pdf-support
import anthropic
import base64

client = anthropic.Anthropic(api_key="sk-...")

# Load PDF (from database or download)
with open("bestemmingsplan.pdf", "rb") as f:
    pdf_data = base64.standard_b64encode(f.read()).decode("utf-8")

# Parse with caching enabled
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_data
                    },
                    # Enable prompt caching for 90% cost reduction
                    "cache_control": {"type": "ephemeral"}
                },
                {
                    "type": "text",
                    "text": "Extract zoning rules from this Dutch bestemmingsplan..."
                }
            ]
        }
    ]
)

print(message.content[0].text)  # Structured JSON output
```

**Cache behavior:**
- First request: Full input tokens charged at standard rate ($3/MTok)
- Subsequent requests (within 24h): 90% discount on cached PDF ($0.30/MTok)
- Cache invalidated if PDF content changes

### Example 2: Structured Output with Pydantic

```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
from pydantic import BaseModel, Field

class ZoningRule(BaseModel):
    article: str = Field(description="Article reference (e.g., 'Artikel 3.1.2')")
    permitted_uses: list[str]
    forbidden_uses: list[str]
    max_height_m: float | None = None
    confidence: str = Field(description="HIGH, MEDIUM, or LOW")

class BestemmingsplanParsed(BaseModel):
    plan_name: str
    plan_idn: str
    rules: list[ZoningRule]

# Use .parse() for automatic Pydantic validation
message = client.messages.parse(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    messages=[...],
    output_format=BestemmingsplanParsed,  # Pydantic model
)

# Access typed output
parsed = message.parsed_output
assert isinstance(parsed, BestemmingsplanParsed)
print(f"Plan: {parsed.plan_name}, Rules: {len(parsed.rules)}")
```

**Guarantees:**
- Output always matches Pydantic schema
- No JSON.parse() errors
- Type-safe access to parsed data

### Example 3: ARQ Job Enqueueing and Status Polling

```python
# Source: https://github.com/davidmuraya/fastapi-arq
from arq import create_pool
from arq.connections import RedisSettings
from arq.jobs import Job, JobStatus

# Enqueue job
arq_pool = await create_pool(RedisSettings())
job = await arq_pool.enqueue_job(
    "pdf_parsing_job",
    plan_idn="NL.IMRO.0363.BP2024CENTRUM-VA01",
    pdf_url="https://..."
)

# Poll job status
while True:
    job_info = await Job(job.job_id, redis=arq_pool).info()

    if job_info.success:
        print(f"Job complete: {job_info.result}")
        break
    elif job_info.status == JobStatus.in_progress:
        print("Job in progress...")
    elif job_info.status == JobStatus.queued:
        print("Job queued, waiting for worker...")

    await asyncio.sleep(2)  # Poll every 2 seconds
```

**Job lifecycle:**
1. `queued`: Job in Redis, worker not started
2. `in_progress`: Worker processing job
3. `complete`: Job finished, result available
4. `not_found`: Job expired (default 1 hour TTL)

### Example 4: PostgreSQL BYTEA File Storage

```python
# Source: SQLAlchemy 2.x documentation
from sqlalchemy import LargeBinary, select
from sqlalchemy.ext.asyncio import AsyncSession

# Store PDF
async def store_pdf(session: AsyncSession, plan_idn: str, pdf_data: bytes):
    pdf_doc = PDFDocument(
        plan_idn=plan_idn,
        file_data=pdf_data,  # BYTEA column
        file_size=len(pdf_data)
    )
    session.add(pdf_doc)
    await session.flush()
    await session.commit()

# Retrieve PDF
async def get_pdf(session: AsyncSession, plan_idn: str) -> bytes:
    stmt = select(PDFDocument).where(PDFDocument.plan_idn == plan_idn)
    result = await session.execute(stmt)
    pdf_doc = result.scalar_one()
    return pdf_doc.file_data  # bytes
```

**Performance notes:**
- BYTEA loads entire file into memory
- Acceptable for 5-30MB bestemmingsplannen
- Not suitable for >100MB files (migrate to S3)

### Example 5: Polling Endpoint Implementation

```python
# Source: https://openillumi.com/en/en-fastapi-long-task-progress-polling/
from fastapi import APIRouter, HTTPException
from arq.jobs import Job

router = APIRouter()

@router.get("/jobs/{job_id}/status")
async def get_job_status(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Poll ARQ job status from Redis.

    Returns:
    - 202: Job processing
    - 200: Job complete with results
    - 404: Job not found (expired or invalid)
    """
    # Validate tenant ownership (see Pitfall 2)
    job_meta = await get_job_metadata(job_id)
    if job_meta.organization_id != current_user.organization_id:
        raise HTTPException(403, "Access denied")

    # Fetch job from Redis
    job = Job(job_id, redis=request.app.state.arq_pool)
    info = await job.info()

    if not info:
        raise HTTPException(404, "Job not found or expired")

    if info.success:
        # Fetch parsed results from PostgreSQL (not Redis)
        parsed_data = await get_cached_or_fetch(
            cache_key=f"ai_parsed:{job_meta.plan_idn}",
            source="bestemmingsplan",
            organization_id=current_user.organization_id,
            fetch_fn=None,
            session=request.state.db
        )
        return {
            "status": "complete",
            "data": parsed_data.data
        }
    elif info.status == JobStatus.in_progress:
        return {
            "status": "in_progress",
            "message": "Parsing bestemmingsplan PDF...",
            "progress_pct": 50
        }
    else:
        return {
            "status": "queued",
            "message": "Job queued, waiting for worker",
            "progress_pct": 0
        }
```

**Frontend integration:**

```typescript
const pollJobStatus = async (jobId: string) => {
  const poll = async () => {
    const response = await fetch(`/api/jobs/${jobId}/status`);

    if (response.status === 200) {
      const data = await response.json();
      if (data.status === 'complete') {
        updateUI(data.data);  // Show parsed results
      } else {
        setTimeout(poll, 2000);  // Poll again in 2s
      }
    } else if (response.status === 404) {
      showError("Job expired or not found");
    }
  };

  poll();
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only PDF extraction (pypdf2) | Claude native PDF vision | 2024-09 | Claude analyzes tables, charts, footnotes as images. Critical for bestemmingsplannen with visual layouts. |
| Celery for async tasks | ARQ (asyncio-native) | 2020-2025 | ARQ eliminates sync/async bridging. Faster, simpler for FastAPI. Celery still preferred for CPU-heavy workloads. |
| Manual JSON parsing + retries | Claude structured outputs | 2024-11 | Guarantees valid JSON matching schema. Eliminates retry loops for malformed responses. |
| No LLM prompt caching | Claude prompt caching (90% discount) | 2024-08 | Makes repeated parsing economically viable. $0.90 → $0.09 for cached plans. |
| WebSocket for job status | HTTP polling pattern | 2018-present | Polling simpler for 10-30s jobs. WebSocket better for <1s real-time updates (e.g., chat). |
| S3 for all file storage | Hybrid (PostgreSQL BYTEA <100MB, S3 >100MB) | 2023-present | BYTEA reduces infrastructure complexity for MVP. Migrate to S3 when files exceed limits. |

**Deprecated/outdated:**
- **PyPDF2:** Officially deprecated 2023, replaced by pypdf (lowercase). But both superseded by Claude native PDF for LLM use cases.
- **Celery Beat for scheduling:** ARQ cron_jobs simpler for asyncio apps. Celery Beat still used in sync Django apps.
- **FastAPI background_tasks for long jobs:** Lacks job tracking. Use only for <5s tasks (e.g., send email notification).

## Open Questions

Things that couldn't be fully resolved:

1. **Ruimtelijkeplannen.nl PDF Download URL Format**
   - What we know: Plans identified by IMRO format (NL.IMRO.{gemeente}.{plan}-{version})
   - What's unclear: Exact URL structure for downloading PDFs from Ruimtelijkeplannen.nl or DSO API
   - Recommendation: Verify during planning phase. Test with known plan_idn from DSO API response. Fallback: Extract PDF URLs from DSO API `_links` section if direct construction fails.

2. **ARQ Worker Deployment Strategy**
   - What we know: ARQ worker runs separately from FastAPI (`arq app.jobs.worker.WorkerSettings`)
   - What's unclear: Whether to run worker on same server (systemd service) or separate container for MVP
   - Recommendation: Same server for MVP (systemd service). Separate container for production (better resource isolation, scaling).

3. **Claude API Rate Limits**
   - What we know: Anthropic enforces rate limits (exact limits depend on tier, not public)
   - What's unclear: How to detect rate limit errors vs other 429/503 errors
   - Recommendation: Check response headers (e.g., `retry-after`). On rate limit, fail job immediately (no retry) and show manual upload option. Monitor Anthropic API dashboard for quota usage.

4. **Bestemmingsplan PDF Size Distribution**
   - What we know: Typical bestemmingsplannen are 5-30MB (research estimate)
   - What's unclear: Percentage of plans >100MB (PostgreSQL BYTEA limit)
   - Recommendation: Start with BYTEA storage. Monitor file_size distribution in production. If >5% exceed 100MB, migrate to S3.

5. **Multiple Active Plans Per Location**
   - What we know: DSO API spatial query returns most relevant plan for coordinates
   - What's unclear: Frequency of multiple active overlapping plans per property
   - Recommendation: Parse only most relevant plan (first result from DSO API). If users report missing plans, add "View all plans" feature in future phase.

## Sources

### Primary (HIGH confidence)

- [Claude API PDF Support Documentation](https://platform.claude.com/docs/en/build-with-claude/pdf-support) - Official Anthropic docs on PDF processing, file size limits (32MB request, 100 pages), base64 encoding, and integration
- [Claude API Structured Outputs Documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) - JSON schema validation, Pydantic integration, output_config.format API
- [Claude API Prompt Caching Documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) - 90% cost reduction, cache_control ephemeral, 24-hour TTL
- [FastAPI Background Tasks Tutorial](https://fastapi.tiangolo.com/tutorial/background-tasks/) - Official FastAPI docs on BackgroundTasks limitations and use cases
- [ARQ Official Documentation](https://arq-docs.helpmanual.io/) - Async Redis queue configuration, job lifecycle, worker settings
- [Ruimtelijke Plannen API Documentation](https://developer.omgevingswet.overheid.nl/api-register/api/rp-opvragen/) - DSO API v4 endpoints, authentication, plan retrieval
- [IMRO2012 Standard Documentation](https://docs.geostandaarden.nl/ro/def-pr-bp2012-20181023/) - IMRO identifier format (NL.IMRO.{gemeente}.{plan}-{version})

### Secondary (MEDIUM confidence)

- [Celery vs ARQ Comparison](https://leapcell.io/blog/celery-versus-arq-choosing-the-right-task-queue-for-python-applications) - ARQ asyncio advantages, Celery battle-tested features
- [FastAPI ARQ Integration Guide](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/) - ARQ setup with FastAPI lifespan, job enqueueing patterns
- [FastAPI Polling Strategy](https://openillumi.com/en/en-fastapi-long-task-progress-polling/) - Polling pattern for long-running tasks, HTTP 202 Accepted
- [PostgreSQL vs S3 Storage](https://wiki.postgresql.org/wiki/BinaryFilesInDB) - BYTEA performance characteristics, 30% storage overhead for encoding
- [Python PDF Extraction Libraries Comparison](https://onlyoneaman.medium.com/i-tested-7-python-pdf-extractors-so-you-dont-have-to-2025-edition-c88013922257) - PyPDF2 vs pdfplumber vs PyMuPDF for text extraction

### Tertiary (LOW confidence)

- Web search results for ARQ maintenance status - ARQ in maintenance-only mode, ReArq as potential successor
- Web search results for bestemmingsplan IMRO identifiers - Real-world examples from municipalities
- Web search results for Anthropic API pricing 2026 - Token costs subject to change

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries officially documented, widely adopted in production
- Architecture patterns: HIGH - Verified with official Anthropic and ARQ examples, FastAPI best practices
- Pitfalls: HIGH - Based on documented limitations (Claude 100-page limit, ARQ Redis TTL, BYTEA size limits)
- Cost optimization: HIGH - Prompt caching documented at 90% discount, token costs from official pricing
- File storage approach: MEDIUM - BYTEA vs S3 tradeoff based on community guidance, not official benchmarks
- PDF download URLs: LOW - Exact Ruimtelijkeplannen.nl URL structure not verified, requires testing

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable ecosystem, but verify Anthropic API changes monthly)

**Key dependencies verified:**
- anthropic SDK 0.40.0+ supports PDF documents, structured outputs, prompt caching
- ARQ 0.27.0 supports asyncio, Redis 5.0+, FastAPI integration
- Pydantic 2.0+ (via FastAPI) supports schema transformation for Claude
- PostgreSQL BYTEA supports binary storage up to 1GB (100MB soft limit for performance)

**Recommendations for planning:**
1. Test Ruimtelijkeplannen.nl PDF download with real IMRO identifiers during task execution
2. Monitor Claude API token costs in development to validate $0.90/parse estimate
3. Verify ARQ worker deployment strategy (systemd vs container) based on server setup
4. Plan for S3 migration path if BYTEA size distribution shows >5% files exceed 100MB
