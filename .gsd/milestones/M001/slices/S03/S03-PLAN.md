# S03: Ai Analysis Doorlooptijd

**Goal:** Add per-ruling AI analysis with vergunningstype classification, text section extraction for token budget control, and doorlooptijd (procedure duration) calculation to the backend.
**Demo:** Add per-ruling AI analysis with vergunningstype classification, text section extraction for token budget control, and doorlooptijd (procedure duration) calculation to the backend.

## Must-Haves


## Tasks

- [x] **T01: 84-ai-analysis-doorlooptijd 01** `est:5min`
  - Add per-ruling AI analysis with vergunningstype classification, text section extraction for token budget control, and doorlooptijd (procedure duration) calculation to the backend.

Purpose: Replace batch-keyed AI analysis (which invalidates cache on filter changes) with per-ruling cache on RulingCache, add vergunningstype taxonomy for actionable classification, and introduce procedure duration metrics for due diligence.

Output: Extended RulingCache model, enhanced AI prompt, DoorlooptijdService, updated analysis endpoint + job, doorlooptijd stats endpoint.
- [x] **T02: 84-ai-analysis-doorlooptijd 02** `est:9min`
  - Wire the frontend to the new per-ruling analysis API, add auto-analysis trigger on feed load, display vergunningstype badges on ruling cards, and show doorlooptijd statistics in JuridischKlimaatCard.

Purpose: Users see analysis results automatically without clicking a button, with actionable vergunningstype classification and procedure duration metrics visible per gemeente.

Output: Updated API types, auto-triggering analysis hook, vergunningstype badges, doorlooptijd statistics card.

## Files Likely Touched

- `backend/app/models/ruling_cache.py`
- `backend/alembic/versions/xxxx_add_ai_analysis_to_ruling_cache.py`
- `backend/app/ai/prompts.py`
- `backend/app/ai/schemas.py`
- `backend/app/ai/claude_client.py`
- `backend/app/services/doorlooptijd.py`
- `backend/app/api/endpoints/jurisprudence.py`
- `backend/app/jobs/jurisprudence_analysis.py`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useJurisprudence.ts`
- `frontend/src/components/projects/JurisprudenceSection.tsx`
- `frontend/src/components/projects/JuridischKlimaatCard.tsx`
