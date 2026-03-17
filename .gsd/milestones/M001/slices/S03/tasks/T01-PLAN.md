# T01: 84-ai-analysis-doorlooptijd 01

**Slice:** S03 — **Milestone:** M001

## Description

Add per-ruling AI analysis with vergunningstype classification, text section extraction for token budget control, and doorlooptijd (procedure duration) calculation to the backend.

Purpose: Replace batch-keyed AI analysis (which invalidates cache on filter changes) with per-ruling cache on RulingCache, add vergunningstype taxonomy for actionable classification, and introduce procedure duration metrics for due diligence.

Output: Extended RulingCache model, enhanced AI prompt, DoorlooptijdService, updated analysis endpoint + job, doorlooptijd stats endpoint.

## Must-Haves

- [ ] "AI analysis runs only on geo-filtered rulings for the selected gemeente, never on unfiltered national results"
- [ ] "Changing date filters does not re-analyze previously analyzed rulings (per-ruling cache)"
- [ ] "Each analyzed ruling gets a vergunningstype classification from a fixed 9-category taxonomy"
- [ ] "Average doorlooptijd per gemeente per vergunningstype is returned, with graceful degradation for insufficient data"

## Files

- `backend/app/models/ruling_cache.py`
- `backend/alembic/versions/xxxx_add_ai_analysis_to_ruling_cache.py`
- `backend/app/ai/prompts.py`
- `backend/app/ai/schemas.py`
- `backend/app/ai/claude_client.py`
- `backend/app/services/doorlooptijd.py`
- `backend/app/api/endpoints/jurisprudence.py`
- `backend/app/jobs/jurisprudence_analysis.py`
