---
phase: 04-ai-document-parsing
plan: 02
subsystem: ai-parsing
tags: [anthropic, claude, pdf, bestemmingsplan, download, parsing, dutch]
requires: [04-01]
provides:
  - Claude AI client with PDF parsing capability
  - Dutch bestemmingsplan extraction prompt with confidence scoring
  - PDF download service from Ruimtelijkeplannen.nl
  - IMRO identifier validation and URL construction
  - User upload support with PostgreSQL storage
tech-stack:
  added: []
  patterns:
    - Anthropic AsyncClient with document message format
    - Base64 PDF encoding with ephemeral prompt caching
    - Regex validation for IMRO plan identifiers
    - httpx AsyncClient parameter pattern for downloads
    - PDF magic byte validation (%PDF header)
key-files:
  created:
    - backend/app/ai/claude_client.py
    - backend/app/ai/prompts.py
    - backend/app/services/pdf_downloader.py
  modified: []
key-decisions:
  - id: 63
    decision: "claude-sonnet-4-5-20250929 for PDF parsing"
    rationale: "Good balance of cost and quality for document extraction; Sonnet 4.5 has native PDF support via vision and structured outputs"
  - id: 64
    decision: "Ephemeral prompt caching for PDF and system prompt"
    rationale: "Reduces API costs for repeated parsing attempts; PDF bytes cached alongside prompt"
  - id: 65
    decision: "JSON extraction with markdown cleanup"
    rationale: "Claude may wrap JSON in markdown code blocks; strip ```json and ``` before Pydantic validation"
  - id: 66
    decision: "AIParsingError with retriable flag"
    rationale: "Distinguishes temporary failures (rate limit, network) from permanent ones (invalid JSON); enables smart retry logic in ARQ worker"
  - id: 67
    decision: "IMRO regex pattern NL.IMRO.{4 digits}.{plan}-{version}"
    rationale: "Standard Dutch zoning plan identifier format; prevents invalid downloads and storage"
  - id: 68
    decision: "Ruimtelijkeplannen.nl URL pattern for auto-download"
    rationale: "Official Dutch government repository for bestemmingsplannen; predictable URL structure enables auto-download"
  - id: 69
    decision: "100MB PDF size limit"
    rationale: "Prevents memory issues and excessive API costs; typical bestemmingsplan PDFs are 1-20MB"
  - id: 70
    decision: "is_user_uploaded boolean flag"
    rationale: "Distinguishes auto-downloaded from manually uploaded PDFs; enables analytics and fallback workflows"
duration: 4m 2s
completed: 2026-02-07
---

# Phase 4 Plan 2: Claude API Client Summary

**One-liner:** Claude Sonnet 4.5 async client with PDF parsing, Dutch confidence scoring, and Ruimtelijkeplannen.nl download service with IMRO validation

---

## Performance

**Execution Time:** 4 minutes 2 seconds
**Tasks Completed:** 2/2 (100%)
**Commits:** 2 atomic commits
**Files Modified:** 0 files
**Files Created:** 3 files (claude_client.py, prompts.py, pdf_downloader.py)

---

## Accomplishments

### Core Capabilities Delivered

**1. Claude AI Client (app/ai/claude_client.py)**
- Async wrapper around `anthropic.AsyncAnthropic`
- `parse_bestemmingsplan(pdf_data, plan_idn)` method returns structured `BestemmingsplanParsed`
- Uses `claude-sonnet-4-5-20250929` model with 16K token limit
- Base64 PDF encoding with document message format
- Ephemeral prompt caching for cost optimization (system prompt + PDF cached)
- JSON response parsing with markdown cleanup (strips ```json wrappers)
- Comprehensive error handling:
  - `anthropic.RateLimitError` → retriable=True
  - `anthropic.APIConnectionError` → retriable=True
  - `anthropic.APIError` → retriable=False
  - Pydantic validation errors → retriable=False
- Custom `AIParsingError` with retriable flag for ARQ retry logic

**2. Dutch Parsing Prompt (app/ai/prompts.py)**
- Extracts 8 zoning rule fields per article:
  1. Artikel (article reference)
  2. Bestemming (zoning designation)
  3. Toegestane gebruiken (permitted uses list)
  4. Verboden gebruiken (forbidden uses list)
  5. Bouwregels (building dimensions: height, gutter, coverage %, area, volume)
  6. Parkeereis (parking requirements)
  7. Milieurestrictions (environmental restrictions)
  8. Bijzondere voorwaarden (special conditions, exceptions)
- Confidence scoring per rule (HIGH/MEDIUM/LOW):
  - HIGH: Clear, unambiguous text without external references
  - MEDIUM: Cross-references, conditional rules, compound requirements
  - LOW: Unclear formulations, contradictions, missing info, chain determination
- Dutch disclaimers ONLY for LOW-confidence items
- 2-4 sentence Dutch summary (samenvatting) of key findings
- Instruction to extract ALL rules (better uncertain than missing)
- Plan IDN extraction if found in document

**3. PDF Download Service (app/services/pdf_downloader.py)**
- `validate_imro_identifier(plan_idn)` - Regex validation: `^NL\.IMRO\.\d{4}\..+-\w+$`
- `construct_pdf_url(plan_idn)` - URL pattern: `https://www.ruimtelijkeplannen.nl/documents/{plan_idn}/d_{plan_idn}.pdf`
- `download_and_store_pdf(plan_idn, organization_id, session, client)` - Main download flow:
  1. Check if PDF already stored (avoid duplicate downloads)
  2. Validate IMRO identifier format
  3. Construct download URL
  4. Download with httpx (60s timeout, follow redirects)
  5. Validate PDF magic bytes (%PDF header)
  6. Validate size <= 100MB
  7. Store in PDFDocument with metadata (source_url, is_user_uploaded=False)
  8. Commit to database
- `store_uploaded_pdf(plan_idn, pdf_data, organization_id, session)` - User upload path:
  - Same validation (magic bytes, size, IMRO format)
  - Sets `is_user_uploaded=True`, `source_url=None`
- `get_stored_pdf(plan_idn, organization_id, session)` - Check existing storage
- Error handling with `PDFDownloadError`:
  - Invalid IMRO format → clear error message
  - HTTP 404 → "PDF not found at Ruimtelijkeplannen.nl"
  - Timeout → "Download timeout after 60 seconds"
  - Invalid PDF → "Missing %PDF header"
  - Size exceeded → "Exceeds maximum 100MB"

---

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create Claude AI client with structured PDF parsing | 1f987bf | claude_client.py, prompts.py |
| 2 | Create PDF download service with IMRO validation | af271d5 | pdf_downloader.py |

---

## Files Created/Modified

**Created (3 files):**
- `backend/app/ai/claude_client.py` - ClaudeClient async wrapper with parse_bestemmingsplan
- `backend/app/ai/prompts.py` - BESTEMMINGSPLAN_PARSING_PROMPT Dutch extraction instructions
- `backend/app/services/pdf_downloader.py` - Download, validation, and storage service

**Modified (0 files):**
- None

---

## Decisions Made

**Decision 63: claude-sonnet-4-5-20250929 for PDF parsing**
- **Context:** Model selection for bestemmingsplan document extraction
- **Choice:** Use Claude Sonnet 4.5 (not Opus or Haiku)
- **Rationale:** Best balance of cost and quality for document parsing; native PDF support via vision API; structured outputs; proven performance on Dutch legal documents
- **Impact:** All parsing jobs use this model; cost ~$3-8 per plan depending on length

**Decision 64: Ephemeral prompt caching for PDF and system prompt**
- **Context:** Anthropic charges per token; large PDFs increase costs
- **Choice:** Add `cache_control: {"type": "ephemeral"}` to system prompt and PDF document blocks
- **Rationale:** Reduces costs for repeated parsing attempts of same PDF; cache persists 5 minutes
- **Impact:** Retry attempts use cached PDF (90% cost reduction on cached requests)

**Decision 65: JSON extraction with markdown cleanup**
- **Context:** Claude may wrap JSON responses in markdown code blocks
- **Choice:** Strip ```json and ``` markers before Pydantic validation
- **Rationale:** Claude's output format varies; defensive parsing prevents validation errors
- **Impact:** Increases parsing robustness; handles both raw JSON and markdown-wrapped responses

**Decision 66: AIParsingError with retriable flag**
- **Context:** Different error types require different retry strategies
- **Choice:** Custom exception with `retriable: bool` attribute
- **Rationale:** Rate limits and network errors should retry; invalid JSON should not (immediate fail)
- **Impact:** ARQ worker can implement exponential backoff for retriable errors, immediate failure for permanent ones

**Decision 67: IMRO regex pattern NL.IMRO.{4 digits}.{plan}-{version}**
- **Context:** Need to validate plan identifiers before download/storage
- **Choice:** Strict regex: `^NL\.IMRO\.\d{4}\..+-\w+$`
- **Rationale:** Standard Dutch bestemmingsplan identifier format; prevents storage of invalid identifiers
- **Impact:** Early validation failure with clear error message; prevents wasted API calls

**Decision 68: Ruimtelijkeplannen.nl URL pattern for auto-download**
- **Context:** PDFs hosted on government portal with predictable URLs
- **Choice:** Construct URL as `https://www.ruimtelijkeplannen.nl/documents/{plan_idn}/d_{plan_idn}.pdf`
- **Rationale:** Official repository; stable URL structure enables auto-download without search
- **Impact:** Direct downloads without scraping; fallback to user upload on 404

**Decision 69: 100MB PDF size limit**
- **Context:** Need to prevent memory issues and excessive API costs
- **Choice:** Hard limit of 100MB for both downloads and uploads
- **Rationale:** Typical bestemmingsplan PDFs are 1-20MB; 100MB allows outliers while preventing abuse
- **Impact:** Rejects oversized files with clear error; prevents Claude API timeouts

**Decision 70: is_user_uploaded boolean flag**
- **Context:** Need to distinguish auto-downloaded from manually uploaded PDFs
- **Choice:** Add `is_user_uploaded: bool` to PDFDocument model
- **Rationale:** Enables analytics (how often auto-download fails?), audit trail, and potential future workflows (e.g., manual review of uploads)
- **Impact:** Auto-downloads set False, user uploads set True; queryable for reporting

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Issues Encountered

None. All tasks completed successfully without blockers.

---

## Integration Points

**Upstream Dependencies (from 04-01):**
- `app.ai.schemas.BestemmingsplanParsed` - Return type for ClaudeClient
- `app.models.pdf_document.PDFDocument` - Database model for storage
- `app.core.config.settings.ANTHROPIC_API_KEY` - API key from config

**Downstream Usage (for 04-03, 04-04):**
- **ARQ Worker (Plan 03):** Will call `ClaudeClient.parse_bestemmingsplan()` in background job
- **API Endpoints (Plan 04):** Will call `download_and_store_pdf()` when zoning plan detected, `store_uploaded_pdf()` for user uploads
- **Error Handling:** `AIParsingError.retriable` flag enables smart retry logic in ARQ
- **Job Status:** ClaudeClient errors mapped to ParsingJob status (failed, error_message)

**Pattern Compliance:**
- httpx.AsyncClient received as parameter (not created internally) ✓
- Direct `db.add()/db.flush()/db.commit()` transaction pattern ✓
- Naive UTC datetimes with `datetime.utcnow()` ✓
- logging.getLogger(__name__) for module-level logger ✓
- Multi-tenant isolation (organization_id in all queries) ✓

---

## Next Phase Readiness

**Ready for Plan 04-03 (ARQ Worker):**
- ✅ ClaudeClient.parse_bestemmingsplan() ready to call
- ✅ download_and_store_pdf() ready to fetch PDFs
- ✅ AIParsingError.retriable enables retry logic
- ✅ All dependencies installed (anthropic, arq from 04-01)

**Ready for Plan 04-04 (API Endpoints):**
- ✅ PDF storage functions callable from FastAPI routes
- ✅ User upload validation ready
- ✅ Error types defined for HTTP response mapping

**Blockers:**
- None

**Required for Testing:**
- `ANTHROPIC_API_KEY` must be set in `backend/.env` before calling ClaudeClient
- Redis running on localhost:6379 (for ARQ in Plan 03, not this plan)
- Real bestemmingsplan PDF for integration testing (can use NL.IMRO.0363.* examples)

---

## Self-Check: PASSED

**Files Created (3/3):**
- ✅ backend/app/ai/claude_client.py
- ✅ backend/app/ai/prompts.py
- ✅ backend/app/services/pdf_downloader.py

**Commits (2/2):**
- ✅ 1f987bf (Task 1)
- ✅ af271d5 (Task 2)

**Verifications:**
- ✅ All imports successful
- ✅ Prompt length: 2326 chars
- ✅ IMRO validation works (valid identifiers accepted, invalid rejected)
- ✅ PDF URL construction returns valid URLs
- ✅ ruff check passes (all files clean)

All claims verified. Ready for next plan.
