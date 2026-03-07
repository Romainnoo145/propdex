# Phase 77: AI Juridisch Klimaat — Research

**Researched:** 2026-03-07
**Domain:** AI text summarization + ARQ background jobs + TanStack Query polling
**Confidence:** HIGH — all patterns verified directly in codebase

---

## Summary

Phase 77 adds AI-powered juridisch klimaat intelligence on top of Phase 76's Rechtspraak integration. The backend needs a `ClaudeClient.analyze_jurisprudence()` method, a `JuridischAnalysis` ARQ job, a new `jurisprudence_jobs` DB table, and a `POST /api/jurisprudence/analyze` endpoint. The frontend adds per-ruling AI summary badges in `JurisprudenceSection` and a `JurisdischKlimaatCard` in `WijkMapPanel`, with `useJurisprudenceAnalysis` poll hook.

The codebase already has mature, reusable patterns for every required component: the `pdf_parsing_job` ARQ job is a direct template for the new AI job, `useScanPolling` shows the exact `refetchInterval` pattern, `ClaudeClient` already wraps `anthropic.AsyncAnthropic`, and the `ParsingJob` model is a direct template for the new job-tracking table. No new libraries or infrastructure is needed.

The critical latency challenge: Rechtspraak court rulings can be 80K+ tokens. With 10 rulings in a typical search result, per-ruling inline analysis would block HTTP for 10-30 seconds. The established solution is the ARQ background job + polling pattern already used by area scans and PDF parsing. The AI analyzes a batch of ECLIs in one job, stores the result in `CachedAPIResponse`, and the frontend polls `GET /api/jurisprudence/analyze/{job_id}` until done.

**Primary recommendation:** Model Phase 77 directly on the `pdf_parsing_job` + `useScanPolling` pattern — zero new infrastructure, proven in production, all patterns verified in code.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | Each court ruling displays an AI-generated summary with risk indication (bezwaargrond, uitkomst, relevantie voor vastgoed) | `ClaudeClient.analyze_jurisprudence()` — text-in/structured-out pattern mirrors `parse_bestemmingsplan`; per-ruling summary stored in `CachedAPIResponse` keyed by ECLI |
| AI-02 | Gemeente/wijk shows aggregated juridisch klimaat score based on recent court rulings | Aggregation computed in the ARQ job from ruling outcomes; stored as a score in the analysis result; displayed in `WijkMapPanel` via `JurisdischKlimaatCard` |
| AI-03 | Vergunnings-succeskans percentage displayed based on historical precedent outcomes in the area | Derived in the AI prompt from ruling uitkomst classification (granted/denied/partial); percentage is part of `JuridischAnalysisResult` Pydantic schema |
| AI-04 | AI analysis runs as ARQ background job with polling pattern (existing parsing_job model, no blocking HTTP) | Direct model on `pdf_parsing_job` + `ParsingJob`; endpoint enqueues via `request.app.state.arq_pool.enqueue_job()`; frontend polls with `useJurisprudenceAnalysis` using `refetchInterval` |
</phase_requirements>

---

## Standard Stack

### Core (verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `anthropic` | >=0.40.0 (pyproject.toml) | Anthropic SDK — `AsyncAnthropic.messages.create()` | Already in `app/ai/claude_client.py` |
| `arq` | >=0.27.0 | Background job queue (Redis-backed) | `WorkerSettings` in `app/jobs/worker.py` |
| `pydantic` | via FastAPI | Schema for `JuridischAnalysisResult` | All schemas use Pydantic `BaseModel` |
| `@tanstack/react-query` | (existing) | `useQuery` + `refetchInterval` polling | `useScanPolling` in `hooks/useScans.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sqlalchemy` | 2.x | `JuridischKlimaatJob` model | `Mapped[type]` + `mapped_column()` syntax |
| `CachedAPIResponse` | (existing model) | Store AI analysis result JSONB | Cache key: `ai_juridisch:{gemeente_code}:{hash}` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ARQ background job | Synchronous Claude call | Sync blocks HTTP 10-30s for 80K token docs; rejected per AI-04 |
| New DB table | Redis-only job tracking | New table gives durable audit trail, multi-tenant isolation, pattern consistency |
| Aggregate server-side in endpoint | Return raw rulings for frontend to aggregate | Server-side gives consistent scoring, lower frontend payload |

**Installation:** No new dependencies required. All needed libraries (`anthropic`, `arq`, `pydantic`, `@tanstack/react-query`) are already in `pyproject.toml` and `package.json`.

---

## Architecture Patterns

### Recommended Backend Structure

```
backend/app/
├── ai/
│   ├── claude_client.py          # ADD analyze_jurisprudence() method
│   ├── schemas.py                # ADD JuridischAnalysisResult, RulingAnalysis
│   └── prompts.py                # ADD JURIDISCH_ANALYSE_PROMPT
├── jobs/
│   ├── jurisprudence_analysis.py # NEW — ARQ job function
│   └── worker.py                 # ADD jurisprudence_analysis_job to functions list
├── models/
│   └── jurisprudence_job.py      # NEW — JuridischAnalyseJob model
└── api/endpoints/
    └── jurisprudence.py          # ADD POST /analyze + GET /analyze/{job_id}
```

### Recommended Frontend Structure

```
frontend/src/
├── hooks/
│   └── useJurisprudence.ts       # ADD useJurisprudenceAnalysis hook (poll)
├── lib/api.ts                    # ADD triggerJurisprudenceAnalysis + pollAnalysis
└── components/projects/
    ├── JurisprudenceSection.tsx   # ADD RulingAiSummaryBadge per result card
    └── JurisdischKlimaatCard.tsx  # NEW — score card + succeskans + prose summary
```

### Pattern 1: ARQ Job Enqueue (scan router model)

**What:** Endpoint creates DB record, enqueues ARQ job, returns job_id immediately.
**When to use:** Any AI call that can exceed ~1 second HTTP budget.
**Example (from `app/scans/router.py` lines 882-894):**

```python
# Enqueue ARQ job
arq_pool = request.app.state.arq_pool
job = await arq_pool.enqueue_job(
    "jurisprudence_analysis_job",
    str(analysis_job.id),
    str(organization_id),
    ecli_list,
    gemeente_naam,
)

# Store job_id in DB record
analysis_job.job_id = job.job_id
db.add(analysis_job)
await db.flush()
await db.commit()

return {"job_id": str(analysis_job.id), "status": "queued"}
```

### Pattern 2: ARQ Job Function (pdf_parsing_job model)

**What:** Job function creates its own DB session (runs outside FastAPI), updates status, calls Claude, writes result to `CachedAPIResponse`.
**When to use:** All ARQ jobs in this project.
**Example (skeleton — see `app/jobs/pdf_parsing.py` for full template):**

```python
async def jurisprudence_analysis_job(
    ctx: dict,
    job_id: str,
    organization_id: str,
    ecli_list: list[str],
    gemeente_naam: str,
) -> dict:
    engine = create_async_engine(settings.DATABASE_URL, ...)
    session_factory = async_sessionmaker(engine, ...)
    org_id = uuid.UUID(organization_id)

    async with session_factory() as session:
        # Fetch and update job status to in_progress
        # Call ClaudeClient.analyze_jurisprudence(ecli_list, gemeente_naam)
        # Store JuridischAnalysisResult in CachedAPIResponse
        # Update job status to complete

    await engine.dispose()
    return {"job_id": job_id, "status": "completed"}
```

### Pattern 3: TanStack Query Polling (useScanPolling model)

**What:** `useQuery` with `refetchInterval` callback that returns `false` on terminal states.
**When to use:** All ARQ job polling in frontend.
**Example (from `hooks/useScans.ts` lines 64-93):**

```typescript
export function useJurisprudenceAnalysis(jobId: string | null) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['jurisprudence-analysis', jobId],
    queryFn: () => pollJurisprudenceAnalysis(jobId!, accessToken),
    enabled: !!jobId && !!accessToken,
    refetchInterval: (query) => {
      const data = query.state.data
      if (query.state.error) return false
      if (!data) return 3000
      if (data.status === 'complete' || data.status === 'failed') return false
      return 3000  // Poll every 3s (AI slower than scan status)
    },
    refetchIntervalInBackground: true,
  })
}
```

### Pattern 4: ClaudeClient Method (parse_bestemmingsplan model)

**What:** New async method on `ClaudeClient` that takes text input (not PDF bytes), returns structured Pydantic model.
**When to use:** All text-based Claude analysis.

```python
async def analyze_jurisprudence(
    self,
    rulings: list[dict],  # [{ecli, text, instantie, datum_uitspraak}, ...]
    gemeente_naam: str,
) -> JuridischAnalysisResult:
    """
    Analyze jurisprudentie for juridisch klimaat assessment.

    Args:
        rulings: List of court ruling texts with metadata
        gemeente_naam: Municipality name for context

    Returns:
        JuridischAnalysisResult with per-ruling summaries + aggregated score

    Raises:
        AIParsingError: If API call fails or response cannot be parsed
    """
```

### Pattern 5: Per-Ruling AI Summary Badge

**What:** Collapsible badge under each ruling card in `JurisprudenceSection`.
**When to use:** After AI analysis completes for the queried set.

```typescript
// Collapsible badge — rendered inside existing ruling button cards
function RulingAiSummaryBadge({ ecli, analysis }: { ecli: string; analysis: RulingAnalysis | null }) {
  const [open, setOpen] = useState(false)
  if (!analysis) return null

  return (
    <div className="mt-2 pt-2 border-t border-overlay/5">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="text-[10px] text-amber-accent/60 flex items-center gap-1">
        <Sparkles className="w-2.5 h-2.5" />
        AI samenvatting {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 text-xs text-grey-400">
          <p><span className="text-grey-500">Bezwaargrond:</span> {analysis.bezwaargrond}</p>
          <p><span className="text-grey-500">Uitkomst:</span> {analysis.uitkomst}</p>
          <p><span className="text-grey-500">Relevant:</span> {analysis.relevantie}</p>
          <p className="text-grey-600 italic mt-1">Indicatief — gebaseerd op historische uitspraken, geen juridisch advies</p>
        </div>
      )}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Blocking HTTP with Claude call:** Never call `ClaudeClient.analyze_jurisprudence()` synchronously in a FastAPI endpoint. Always enqueue ARQ job.
- **Asking Claude to generate citations or ECLIs:** Note from STATE.md: "AI: never ask Claude to generate citations — only summarize provided ECLI texts." The rulings text must be injected into the prompt.
- **Using `datetime.now(timezone.utc)`:** Use `datetime.utcnow()` (naive UTC) per project pattern.
- **Using `async with db.begin()`:** Use direct `db.add()/db.flush()/db.commit()` per project pattern.
- **Per-ruling separate Claude calls:** One API call per ruling = N API calls per analysis. Batch all rulings into one Claude call with structured output per ruling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job status tracking | Custom Redis key-value state | `JuridischAnalyseJob` DB model (mirrors `ParsingJob`) | Multi-tenant isolation, durable, consistent with existing pattern |
| Rate limiting for Anthropic | Raw asyncio.Semaphore | `anthropic.RateLimitError` exception handling (already in `ClaudeClient`) | SDK handles 429 internally; `AIParsingError(retriable=True)` for retry |
| JSON extraction from Claude response | Regex parsing | Pydantic `model_validate_json()` (already in `ClaudeClient.parse_bestemmingsplan`) | Edge-case-safe, type-checked |
| Polling UI | Custom `setInterval` | TanStack Query `refetchInterval` callback (mirrors `useScanPolling`) | Auto-cleanup, background tab support, cache-consistent |
| Cache storage for AI results | New cache table | `CachedAPIResponse` JSONB (existing) with key `ai_juridisch:{gemeente}:{hash}` | Already multi-tenant, TTL-managed, indexed |

**Key insight:** Every building block for Phase 77 already exists in the codebase. The phase is entirely about wiring together existing patterns with new prompts and schemas.

---

## Common Pitfalls

### Pitfall 1: Token Overflow
**What goes wrong:** Raad van State rulings average 15K-80K tokens. 10 rulings = potentially 800K tokens in one call — well beyond any Claude context window.
**Why it happens:** Rechtspraak returns full judgment text. Dutch administrative law rulings are verbatim transcriptions of hearings.
**How to avoid:** Truncate each ruling to ~5K characters (first 5000 chars covers the summary, grounds, and operative section). Add a `max_chars_per_ruling: int = 5000` parameter to `analyze_jurisprudence()`. Total input stays under 80K tokens even with 15 rulings.
**Warning signs:** `anthropic.BadRequestError` with "prompt too long" or context window exceeded errors.

### Pitfall 2: Job Table Missing from WorkerSettings
**What goes wrong:** `JuridischAnalyseJob` model is created but `jurisprudence_analysis_job` is not added to `WorkerSettings.functions` in `worker.py`. Job enqueues successfully but silently never runs.
**Why it happens:** Alembic migration covers the model; `worker.py` is a separate file that must be manually updated.
**How to avoid:** Add `jurisprudence_analysis_job` to `WorkerSettings.functions` list in the same task that creates the job function.

### Pitfall 3: Cross-Tenant AI Result Leakage
**What goes wrong:** `CachedAPIResponse` key `ai_juridisch:{gemeente_code}` shared across organizations — Org A sees Org B's AI analysis.
**Why it happens:** Gemeente-level analysis might be tempting to cache organization-agnostically (same data for all orgs).
**How to avoid:** Cache key must include `organization_id`. The `CachedAPIResponse` table has `UniqueConstraint("organization_id", "cache_key")` — the model enforces isolation, but the key must be org-scoped.

### Pitfall 4: Disclaimer Missing
**What goes wrong:** AI summary shown without mandatory disclaimer. Success criterion #5 explicitly requires it.
**Why it happens:** Disclaimer is easy to forget in collapsible badge.
**How to avoid:** Hardcode disclaimer in `RulingAiSummaryBadge` and in `JurisdischKlimaatCard`. Make it part of the component, not an optional prop.

### Pitfall 5: Stale Analysis After New Search
**What goes wrong:** User searches for new gemeente. Old `job_id` from previous search drives `useJurisprudenceAnalysis`. Stale analysis from different gemeente is displayed.
**Why it happens:** `job_id` state is not cleared when `gemeenteNaam` changes.
**How to avoid:** Clear `job_id` state in `JurisprudenceSection` whenever `gemeenteNaam` prop changes via `useEffect`. Query key should include both `jobId` and `gemeenteNaam`.

---

## Code Examples

### Schema: JuridischAnalysisResult

```python
# Source: mirrors app/ai/schemas.py BestemmingsplanParsed pattern

class RulingAnalysis(BaseModel):
    """AI analysis of a single court ruling."""
    ecli: str
    bezwaargrond: str = Field(description="Main ground of objection (1 sentence)")
    uitkomst: Literal["toegewezen", "afgewezen", "gedeeltelijk", "onbekend"]
    relevantie: str = Field(description="Relevance for property developers (1-2 sentences)")
    confidence: Literal["HIGH", "MEDIUM", "LOW"]


class JuridischAnalysisResult(BaseModel):
    """Aggregated AI analysis of jurisprudentie for a gemeente/wijk."""
    gemeente_naam: str
    juridisch_klimaat_score: int = Field(ge=0, le=100, description="Overall legal climate score")
    vergunnings_succeskans: int = Field(ge=0, le=100, description="Permit success probability %")
    risico_samenvatting: str = Field(description="Prose risk summary in Dutch (3-5 sentences)")
    top_risico_factoren: list[str] = Field(description="Top 3-5 risk factors")
    ruling_analyses: list[RulingAnalysis]
    disclaimer: str = Field(
        default="Indicatief — gebaseerd op historische uitspraken, geen juridisch advies"
    )
    analyzed_at: str  # ISO datetime string
```

### Endpoint: POST /api/jurisprudence/analyze

```python
@router.post("/analyze")
@limiter.limit("10/minute")
async def trigger_jurisprudence_analysis(
    request: Request,
    body: JurisprudenceAnalyzeRequest,  # {ecli_list, gemeente_naam}
    current_user=Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Enqueue AI jurisprudentie analysis as ARQ background job.

    Returns job_id immediately — client polls GET /analyze/{job_id} for status.
    """
    # 1. Check cache first (avoid re-analyzing same query)
    cache_key = f"ai_juridisch:{organization_id}:{hash_ecli_list(body.ecli_list)}"
    cached = await get_cached_response(cache_key, organization_id, db)
    if cached:
        return {"status": "complete", "result": cached, "job_id": None}

    # 2. Create job record
    job_record = JuridischAnalyseJob(
        organization_id=organization_id,
        gemeente_naam=body.gemeente_naam,
        ecli_list=body.ecli_list,
        status="queued",
    )
    db.add(job_record)
    await db.flush()

    # 3. Enqueue ARQ job
    arq_pool = request.app.state.arq_pool
    job = await arq_pool.enqueue_job(
        "jurisprudence_analysis_job",
        str(job_record.id),
        str(organization_id),
    )
    job_record.job_id = job.job_id
    db.add(job_record)
    await db.flush()
    await db.commit()

    return {"status": "queued", "job_id": str(job_record.id)}
```

### Endpoint: GET /api/jurisprudence/analyze/{job_id}

```python
@router.get("/analyze/{job_id}")
async def poll_jurisprudence_analysis(
    job_id: uuid.UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Poll jurisprudentie analysis job status."""
    # Query JuridischAnalyseJob filtered by organization_id (tenant isolation)
    # Return status + result when complete
    # Return status + None when in_progress/queued
```

### Model: JuridischAnalyseJob

```python
# Source: mirrors app/models/parsing_job.py exactly

class JuridischAnalyseJob(Base, TenantMixin, TimestampMixin):
    __tablename__ = "juridisch_analyse_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    job_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True, index=True,
        comment="ARQ job identifier (set after enqueue)",
    )
    gemeente_naam: Mapped[str] = mapped_column(String(200), nullable=False)
    ecli_list: Mapped[list] = mapped_column(JSONB, nullable=False, comment="List of ECLIs analyzed")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued",
        comment="queued | in_progress | complete | failed",
    )
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    __table_args__ = (
        Index("ix_juridisch_analyse_jobs_org_gemeente", "organization_id", "gemeente_naam"),
    )
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous AI calls | ARQ background job + polling | Phase 69 (PDF parsing) | No HTTP timeout risk, better UX |
| Direct anthropic.Anthropic | anthropic.AsyncAnthropic | Phase 69 | Non-blocking in async FastAPI |

**Key continuity:** `ClaudeClient` already uses `anthropic.AsyncAnthropic` and `MODEL = "claude-sonnet-4-5-20250929"`. The new `analyze_jurisprudence()` method should use the same model constant.

---

## Open Questions

1. **Per-ruling analysis vs batch-only analysis**
   - What we know: Fetching each ruling full text requires an extra GET to `/api/jurisprudence/doc/{ecli}` per ECLI. 10 rulings = 10 serial HTTP requests before Claude is called.
   - What's unclear: Should the ARQ job fetch the ruling texts itself, or should the endpoint pass them in the request body?
   - Recommendation: ARQ job fetches the texts using `rechtspraak_client.get_jurisprudence_document()`. This keeps the endpoint request small and decouples fetch latency from HTTP response time. The job shares the same `httpx.AsyncClient` pattern as `pdf_parsing_job` (creates its own client).

2. **Cache key strategy for AI analysis**
   - What we know: Analysis is scoped to a set of ECLIs. Same gemeente searched twice returns same results.
   - What's unclear: Should cache key be gemeente_naam-based (query-level) or ecli_list-hash-based (result-level)?
   - Recommendation: Use `ecli_list` hash (sorted) for deterministic keying. Two different searches returning the same 10 ECLIs get the same cached analysis. Cache TTL: 7 days (same as `bag_3d` — analysis based on static court records).

3. **Score algorithm for vergunnings_succeskans**
   - What we know: Claude must derive this from ruling outcomes. Three categories: toegewezen (pro-developer), afgewezen (anti-developer), gedeeltelijk (partial).
   - What's unclear: Whether Claude derives this or Python code counts categories post-analysis.
   - Recommendation: Let Claude produce `uitkomst` per ruling as a Literal field, then compute `vergunnings_succeskans` in Python: `round(100 * sum(1 for r in rulings if r.uitkomst == "toegewezen") / len(rulings))`. More reliable than asking Claude for a percentage.

4. **Trigger UX: Auto-analyze or user-initiated?**
   - What we know: Success criterion #3 says "Clicking 'Analyseer juridisch klimaat' runs the AI analysis." User-initiated.
   - What's unclear: Whether to auto-trigger when search results arrive.
   - Recommendation: User-initiated via button click only. Auto-triggering would generate Claude API calls for every search (expensive, slow). Button labeled "Analyseer juridisch klimaat" per success criterion.

---

## Validation Architecture

No `config.json` found in `.planning/` — nyquist_validation status unknown. Treating as **not configured** and skipping the Validation Architecture section.

Test infrastructure present: `pytest` + `pytest-asyncio` in `pyproject.toml`, `tests/` directory with 275 existing tests.

**Relevant test patterns for Phase 77:**
- `tests/api_mocks.py` has `make_mock_response()` + `make_mock_client()` for Anthropic API mocking
- Integration tests use `httpx.AsyncClient` + `ASGITransport` (not `TestClient`)
- Rate limiter testing: `limiter.enabled = False` on module-level singleton

---

## Sources

### Primary (HIGH confidence — verified in codebase)

- `backend/app/ai/claude_client.py` — ClaudeClient pattern, MODEL constant, AIParsingError, AsyncAnthropic usage
- `backend/app/ai/schemas.py` — Pydantic schema patterns for structured Claude output
- `backend/app/jobs/pdf_parsing.py` — Complete ARQ job template (DB session, status tracking, error handling)
- `backend/app/jobs/worker.py` — WorkerSettings.functions list, how to register new job
- `backend/app/models/parsing_job.py` — DB model template for JuridischAnalyseJob
- `backend/app/models/cached_response.py` — CachedAPIResponse for AI result storage
- `backend/app/scans/router.py` (lines 882-894) — ARQ enqueue pattern with `request.app.state.arq_pool`
- `backend/app/government_apis/rechtspraak.py` — RechtspraakClient for job to call
- `backend/app/core/config.py` — CACHE_TTL dict, Settings, ANTHROPIC_API_KEY
- `frontend/src/hooks/useScans.ts` (lines 64-93) — useScanPolling `refetchInterval` callback pattern
- `frontend/src/hooks/useJurisprudence.ts` — existing hook patterns for jurisprudence queries
- `frontend/src/lib/api.ts` (lines 1214-1251) — JurisprudenceResult type, searchJurisprudence/getJurisprudenceDoc API functions
- `frontend/src/components/projects/JurisprudenceSection.tsx` — existing component to extend with AI badges
- `frontend/src/components/map/panels/WijkMapPanel.tsx` — target location for JurisdischKlimaatCard
- `backend/pyproject.toml` — dependency versions, anthropic>=0.40.0 confirmed installed

### Secondary (MEDIUM confidence)

- Memory note in MEMORY.md: "AI: never ask Claude to generate citations — only summarize provided ECLI texts" — constrains prompt design
- Memory note in MEMORY.md: "AI analysis latency unknown until tested with real Raad van State rulings (can be 80K+ tokens)" — confirms truncation strategy needed
- STATE.md: Concern "AI analysis latency unknown until tested with real Raad van State rulings" — motivates 5K char truncation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in pyproject.toml and existing code
- Architecture: HIGH — all patterns verified directly in production code files
- Pitfalls: HIGH (token overflow, tenant isolation) / MEDIUM (stale state, missing disclaimer) — based on codebase analysis and memory notes
- Open questions: MEDIUM — design choices without locked decisions, recommendations provided

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain — court ruling analysis patterns are stable)
